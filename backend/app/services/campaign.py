"""Campaign builder (admin) + creator browse/join. Delete = archive (soft), never hard."""
from __future__ import annotations

import re
import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import _now
from app.models import Campaign, CampaignParticipation, CreatorProfile

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
    db.commit()
    db.refresh(campaign)
    return campaign


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
    db.commit()
    db.refresh(c)
    return c


def publish_campaign(db: Session, campaign_id: uuid.UUID) -> Campaign:
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
    db.commit()
    db.refresh(c)
    return c


def close_campaign(db: Session, campaign_id: uuid.UUID) -> Campaign:
    """Bill's 'close/change state' action: campaign stops accepting entries but
    stays visible (unlike archive). completed = closed."""
    c = get_campaign(db, campaign_id)
    if c.status == "archived":
        raise HTTPException(status.HTTP_409_CONFLICT, "Archived campaigns cannot be closed")
    c.status = "completed"
    db.commit()
    db.refresh(c)
    return c


def archive_campaign(db: Session, campaign_id: uuid.UUID) -> Campaign:
    c = get_campaign(db, campaign_id)
    c.status = "archived"
    c.archived_at = _now()
    db.commit()
    db.refresh(c)
    return c


# ---- creator-facing ----
def list_active_campaigns(db: Session):
    return db.scalars(
        select(Campaign).where(Campaign.status == "active").order_by(Campaign.published_at.desc())
    ).all()


def get_active_campaign(db: Session, slug: str) -> Campaign:
    c = db.scalar(select(Campaign).where(Campaign.slug == slug, Campaign.status == "active"))
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    return c


def creator_has_joined(db: Session, campaign_id: uuid.UUID, creator_id: uuid.UUID) -> bool:
    return db.scalar(
        select(CampaignParticipation.id).where(
            CampaignParticipation.campaign_id == campaign_id,
            CampaignParticipation.creator_id == creator_id,
        )
    ) is not None


def join_campaign(db: Session, creator_id: uuid.UUID, slug: str) -> CampaignParticipation:
    prof = db.scalar(select(CreatorProfile).where(CreatorProfile.creator_id == creator_id))
    if prof is None or prof.completed_at is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "profile_incomplete")
    campaign = get_active_campaign(db, slug)
    existing = db.scalar(
        select(CampaignParticipation).where(
            CampaignParticipation.campaign_id == campaign.id,
            CampaignParticipation.creator_id == creator_id,
        )
    )
    if existing:
        return existing
    part = CampaignParticipation(campaign_id=campaign.id, creator_id=creator_id)
    db.add(part)
    db.commit()
    db.refresh(part)
    return part
