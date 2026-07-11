"""Campaign builder (admin) + creator browse/join. Delete = archive (soft), never hard."""
from __future__ import annotations

import re
import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import _now
from app.models import Campaign, CampaignBonusMilestone, CampaignParticipation, Creator, Submission
from app.services import audit

_MODES = {"create_new", "copy_paste"}


def _slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "campaign"
    return base[:60]


def _unique_slug(db: Session, name: str) -> str:
    base = _slugify(name)
    slug = base
    while db.scalar(select(Campaign.id).where(Campaign.slug == slug)):
        slug = f"{base}-{uuid.uuid4().hex[:6]}"
    return slug


def _check_mode_content(mode: str, brief_script, content_drive_url) -> None:
    if mode not in _MODES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid campaign mode")
    if mode == "create_new" and not (brief_script and brief_script.strip()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "create_new campaigns need a brief_script")
    if mode == "copy_paste" and not (content_drive_url and content_drive_url.strip()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "copy_paste campaigns need a content_drive_url")


def create_campaign(db: Session, admin_id: uuid.UUID, data: dict) -> Campaign:
    data = dict(data)
    bonus_milestones = data.pop("bonus_milestones", None) or []
    _check_mode_content(data["mode"], data.get("brief_script"), data.get("content_drive_url"))
    if data["cpm_rate"] <= 0 or data["budget"] <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cpm_rate and budget must be positive")
    # create_new keeps content_drive_url NULL (DB constraint requires it)
    if data["mode"] == "create_new":
        data["content_drive_url"] = None
    campaign = Campaign(
        created_by=admin_id, slug=_unique_slug(db, data["name"]),
        client_id=uuid.UUID(data["client_id"]) if data.get("client_id") else None,
        **{k: v for k, v in data.items() if k not in ("client_id",)},
    )
    db.add(campaign)
    db.flush()
    _replace_bonus_milestones(db, campaign.id, bonus_milestones)
    db.commit()
    db.refresh(campaign)
    return campaign


def _replace_bonus_milestones(db: Session, campaign_id: uuid.UUID, milestones: list) -> None:
    """Step 3 of the wizard: bonus milestones are always fully replaced on write
    (create sends the initial set; update resends the whole edited list)."""
    db.query(CampaignBonusMilestone).filter(
        CampaignBonusMilestone.campaign_id == campaign_id
    ).delete()
    for idx, m in enumerate(milestones):
        m = m if isinstance(m, dict) else m.model_dump()
        db.add(
            CampaignBonusMilestone(
                campaign_id=campaign_id,
                views_threshold=m["views_threshold"],
                bonus_amount=m["bonus_amount"],
                description=m.get("description"),
                sort_order=m.get("sort_order", idx),
            )
        )


def get_campaign(db: Session, campaign_id: uuid.UUID) -> Campaign:
    c = db.get(Campaign, campaign_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    return c


def list_campaigns(db: Session, status_filter: str | None = None):
    q = select(Campaign).order_by(Campaign.created_at.desc())
    if status_filter:
        q = q.where(Campaign.status == status_filter)
    return db.scalars(q).all()


def update_campaign(db: Session, campaign_id: uuid.UUID, data: dict) -> Campaign:
    c = get_campaign(db, campaign_id)
    if c.status == "archived":
        raise HTTPException(status.HTTP_409_CONFLICT, "Archived campaigns cannot be edited")
    data = dict(data)
    milestones_provided = "bonus_milestones" in data
    bonus_milestones = data.pop("bonus_milestones", None) or []
    new_mode = c.mode
    new_brief = data.get("brief_script", c.brief_script)
    new_drive = data.get("content_drive_url", c.content_drive_url)
    _check_mode_content(new_mode, new_brief, new_drive)
    # Revalidate money invariants before they reach the DB CHECK constraints
    # (otherwise a bad value would surface as a generic 500).
    if data.get("cpm_rate") is not None and data["cpm_rate"] <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cpm_rate must be positive")
    if data.get("budget") is not None and data["budget"] <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "budget must be positive")
    for field, value in data.items():
        if value is not None and field != "client_id":
            setattr(c, field, value)
    if "client_id" in data:
        c.client_id = uuid.UUID(data["client_id"]) if data["client_id"] else None
    if milestones_provided:
        _replace_bonus_milestones(db, c.id, bonus_milestones)
    db.commit()
    db.refresh(c)
    return c


def publish_campaign(db: Session, campaign_id: uuid.UUID, admin_id: uuid.UUID | None = None) -> Campaign:
    c = get_campaign(db, campaign_id)
    if c.status == "archived":
        raise HTTPException(status.HTTP_409_CONFLICT, "Archived campaigns cannot be published")
    if not c.platforms:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Add at least one platform before publishing")
    _check_mode_content(c.mode, c.brief_script, c.content_drive_url)
    if c.starts_at and c.ends_at and c.starts_at >= c.ends_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "starts_at must be before ends_at")
    c.status = "active"
    c.published_at = c.published_at or _now()
    audit.log(db, actor_admin_id=admin_id, action="campaign.publish", entity_type="campaign", entity_id=c.id)
    db.commit()
    db.refresh(c)
    return c


def close_campaign(db: Session, campaign_id: uuid.UUID, admin_id: uuid.UUID | None = None) -> Campaign:
    """Bill's 'close/change state' action: campaign stops accepting entries but
    stays visible (unlike archive). completed = closed."""
    c = get_campaign(db, campaign_id)
    if c.status == "archived":
        raise HTTPException(status.HTTP_409_CONFLICT, "Archived campaigns cannot be closed")
    c.status = "completed"
    audit.log(db, actor_admin_id=admin_id, action="campaign.close", entity_type="campaign", entity_id=c.id)
    db.commit()
    db.refresh(c)
    return c


def reopen_campaign(db: Session, campaign_id: uuid.UUID, admin_id: uuid.UUID | None = None) -> Campaign:
    """Reopen a closed (completed/paused) campaign so it accepts entries again."""
    c = get_campaign(db, campaign_id)
    if c.status not in ("completed", "paused"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Only closed campaigns can be reopened")
    c.status = "active"
    c.published_at = c.published_at or _now()
    audit.log(db, actor_admin_id=admin_id, action="campaign.reopen", entity_type="campaign", entity_id=c.id)
    db.commit()
    db.refresh(c)
    return c


def archive_campaign(db: Session, campaign_id: uuid.UUID, admin_id: uuid.UUID | None = None) -> Campaign:
    c = get_campaign(db, campaign_id)
    c.status = "archived"
    c.archived_at = _now()
    audit.log(db, actor_admin_id=admin_id, action="campaign.archive", entity_type="campaign", entity_id=c.id)
    db.commit()
    db.refresh(c)
    return c


# ---- creator-facing ----
def list_active_campaigns(db: Session):
    return db.scalars(
        select(Campaign).where(Campaign.status == "active").order_by(Campaign.published_at.desc())
    ).all()


def list_completed_campaigns(db: Session):
    """Publicly browsable past campaigns (for the landing 'Completed' tab)."""
    return db.scalars(
        select(Campaign).where(Campaign.status == "completed").order_by(Campaign.published_at.desc())
    ).all()


def get_active_campaign(db: Session, slug: str) -> Campaign:
    c = db.scalar(select(Campaign).where(Campaign.slug == slug, Campaign.status == "active"))
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    return c


def get_bonus_milestones(db: Session, campaign_id: uuid.UUID) -> list[CampaignBonusMilestone]:
    """Feature 5: eager-fetch bonus milestones for the native brief page (creator +
    public views) — mirrors the admin campaign_out() query."""
    return db.scalars(
        select(CampaignBonusMilestone)
        .where(CampaignBonusMilestone.campaign_id == campaign_id)
        .order_by(CampaignBonusMilestone.sort_order.asc())
    ).all()


def creator_has_joined(db: Session, campaign_id: uuid.UUID, creator_id: uuid.UUID) -> bool:
    return db.scalar(
        select(CampaignParticipation.id).where(
            CampaignParticipation.campaign_id == campaign_id,
            CampaignParticipation.creator_id == creator_id,
        )
    ) is not None


def join_campaign(db: Session, creator_id: uuid.UUID, slug: str) -> CampaignParticipation:
    # Applying to a campaign requires a minimally-complete profile (name + at
    # least one social) — SideShift-style "complete your profile" wall. This is
    # the AUTHENTICATED creator path only; the public email+URL submit flow is
    # separate and intentionally ungated.
    from app.services import socials_verify

    eligible, _missing = socials_verify.apply_eligibility(db, creator_id)
    if not eligible:
        # String detail (not an object) so the frontend matches it directly and
        # opens the "complete your profile" popup on this exact value.
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="profile_incomplete")

    # A creator an admin removed must not be able to walk straight back in.
    creator = db.get(Creator, creator_id)
    if creator is not None and creator.tracking_disabled:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This account can no longer join campaigns.",
        )

    campaign = get_active_campaign(db, slug)
    existing = db.scalar(
        select(CampaignParticipation).where(
            CampaignParticipation.campaign_id == campaign.id,
            CampaignParticipation.creator_id == creator_id,
        )
    )
    if existing:
        if existing.removed_at is not None:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "You were removed from this campaign.",
            )
        return existing
    part = CampaignParticipation(campaign_id=campaign.id, creator_id=creator_id)
    db.add(part)
    db.commit()
    db.refresh(part)
    return part


def list_creator_campaigns(db: Session, creator_id: uuid.UUID) -> list[dict]:
    """Every campaign this creator applied to / joined, newest first, with their
    application status and how many videos they've submitted to it."""
    rows = db.execute(
        select(CampaignParticipation, Campaign)
        .join(Campaign, Campaign.id == CampaignParticipation.campaign_id)
        .where(CampaignParticipation.creator_id == creator_id)
        .order_by(CampaignParticipation.joined_at.desc())
    ).all()
    sub_counts = dict(
        db.execute(
            select(Submission.participation_id, func.count(Submission.id))
            .where(Submission.creator_id == creator_id)
            .group_by(Submission.participation_id)
        ).all()
    )
    return [
        {
            "participation_id": str(p.id),
            "campaign_id": str(c.id),
            "slug": c.slug,
            "name": c.name,
            "brand_name": c.brand_name,
            "mode": c.mode,
            "cpm_rate": c.cpm_rate,
            "status": p.status,
            "submission_count": int(sub_counts.get(p.id, 0)),
        }
        for p, c in rows
    ]
