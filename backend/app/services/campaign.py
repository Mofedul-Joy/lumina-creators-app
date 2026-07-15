"""Campaign builder (admin) + creator browse/join. Delete = archive (soft), never hard."""
from __future__ import annotations

import re
import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session

from app.core.security import _now
from app.models import Campaign, CampaignBonusMilestone, CampaignInvite, CampaignParticipation, Creator, Submission
from app.services import audit

_MODES = {"create_new", "copy_paste"}

# Mirrors the CHECK constraints in 0024 — validated here so a bad value comes
# back as a 400 rather than a 500 from the database.
_KINDS = {"high_volume_ugc", "influencer", "paid_ads", "campaign_manager", "analytics_only"}
_LEVELS = {"essentials", "advanced"}
_SCHEDULES = {"every_7_days", "every_14_days", "every_30_days"}
_TRIGGERS = {"post_delivery", "schedule"}


def _validate_flow_fields(data: dict) -> None:
    checks = (
        ("campaign_kind", _KINDS), ("experience_level", _LEVELS),
        ("payment_schedule", _SCHEDULES), ("payment_cycle_trigger", _TRIGGERS),
    )
    for field, allowed in checks:
        v = data.get(field)
        if v is not None and v not in allowed:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid {field}")
    ppp = data.get("posts_per_payment")
    if ppp is not None and ppp < 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "posts_per_payment must be at least 1")
    mv = data.get("min_views")
    if mv is not None and mv < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "min_views cannot be negative")


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


# NOT NULL columns with a server default: an unsent optional field arrives as
# None, and passing that through would try to INSERT NULL over the default.
_DEFAULTED_COLUMNS = (
    "campaign_kind", "experience_level", "no_platform_tracking",
    "payment_cycle_trigger", "pro_rata", "posts_per_payment",
)


def _drop_unset_defaults(data: dict) -> dict:
    return {k: v for k, v in data.items() if not (k in _DEFAULTED_COLUMNS and v is None)}


_VALID_PLATFORMS = {"instagram", "tiktok", "youtube", "twitter", "facebook"}


def _validate_ranges(data: dict) -> None:
    """App-level guards mirroring the DB CHECK constraints for range/enum fields.
    Without these, an out-of-range value reaches the DB and surfaces as a raw 500
    instead of a clean 400. Only validates keys actually present, so it's safe for
    partial PATCH updates. (min_payout_amount has no DB CHECK — guarded here too.)"""
    def _num(v):
        try:
            return Decimal(str(v))
        except (TypeError, ValueError):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid numeric value")
    if data.get("eligible_view_pct") is not None:
        if not (0 <= _num(data["eligible_view_pct"]) <= 100):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "eligible_view_pct must be between 0 and 100")
    if data.get("platforms"):
        bad = [p for p in data["platforms"] if p not in _VALID_PLATFORMS]
        if bad:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid platform(s): {', '.join(map(str, bad))}")
    if data.get("max_payout_per_creator") is not None and _num(data["max_payout_per_creator"]) <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "max_payout_per_creator must be positive")
    if data.get("min_payout_amount") is not None and _num(data["min_payout_amount"]) < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "min_payout_amount cannot be negative")
    if data.get("min_retention_days") is not None and int(data["min_retention_days"]) < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "min_retention_days cannot be negative")


def _validate_payment_amount(payment_type, fixed_amount, per_post_amount, hourly_rate) -> None:
    """Each non-CPM payment_type needs its own positive rate, otherwise a
    published campaign silently pays creators $0 (compute_owed treats None as 0).
    'mixed' needs fixed_amount too (cpm_rate is checked separately)."""
    def _pos(v) -> bool:
        try:
            return v is not None and Decimal(v) > 0
        except (TypeError, ValueError):
            return False
    if payment_type in ("fixed", "mixed") and not _pos(fixed_amount):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "fixed_amount must be positive for this payment type")
    if payment_type == "per_post" and not _pos(per_post_amount):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "per_post_amount must be positive for per-post campaigns")
    if payment_type == "per_hour" and not _pos(hourly_rate):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "hourly_rate must be positive for per-hour campaigns")


def create_campaign(db: Session, admin_id: uuid.UUID, data: dict) -> Campaign:
    data = _drop_unset_defaults(dict(data))
    _validate_flow_fields(data)
    bonus_milestones = data.pop("bonus_milestones", None) or []
    _check_mode_content(data["mode"], data.get("brief_script"), data.get("content_drive_url"))
    if data["budget"] <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "budget must be positive")
    # cpm_rate only matters for CPM/mixed campaigns — fixed / per_hour / per_post
    # don't pay on views, so a 0 CPM is valid there and must not be rejected.
    _cpm_required = data.get("payment_type") in (None, "cpm", "mixed")
    if _cpm_required and data["cpm_rate"] <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cpm_rate must be positive")
    _validate_payment_amount(
        data.get("payment_type"), data.get("fixed_amount"),
        data.get("per_post_amount"), data.get("hourly_rate"),
    )
    _validate_ranges(data)
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
    # Auto-generate the editable Campaign Participation Agreement template.
    try:
        from app.services import contracts
        contracts.get_or_create_template(db, campaign.id)
    except Exception:  # noqa: BLE001 - never fail campaign creation on the contract seed
        pass
    # No uploaded banner → fetch a topic-relevant stock photo so the card is
    # never a bare wordmark. Best-effort; leaves banner_url empty on any failure.
    ensure_campaign_banner(db, campaign)
    # Turn any pasted example-video links into example rows (with cached
    # thumbnails). Best-effort — a thumbnail hiccup never fails campaign creation.
    for url in (campaign.example_videos or []):
        try:
            from app.services import campaign_examples
            campaign_examples.add_example(db, campaign.id, url, source="admin")
        except Exception:  # noqa: BLE001
            db.rollback()
    return campaign


# Filler words stripped when turning a campaign name into a stock-photo query.
_TOPIC_FILLER = {
    "challenge", "campaign", "launch", "giveaway", "ugc", "video", "app", "the",
    "for", "with", "get", "new", "program", "promo", "promotion", "contest",
    "official", "and", "your",
}


def _topic_candidates(c: Campaign) -> list[str]:
    """Ordered stock-photo queries for a campaign, specific → broad. The search
    tries each until one returns an image, so a narrow name still lands art while
    the generic net at the end guarantees *something* on-topic."""
    import re

    words = [
        w for w in re.findall(r"[A-Za-z]+", c.name or "")
        if len(w) > 2 and w.lower() not in _TOPIC_FILLER
    ]
    ct = (c.content_type or "").replace("_", " ").strip()
    cands: list[str] = []
    if words:
        cands.append(" ".join(words[:2]))   # e.g. "Summer Skincare"
    if ct:
        cands.append(ct)                     # e.g. "beauty"
    if words:
        cands.append(words[-1])              # trailing word is often the category
        cands.append(words[0])
    cands.append("social media content creation")  # always-hits safety net
    seen: list[str] = []
    for q in cands:
        q = q.strip()
        if q and q.lower() not in {s.lower() for s in seen}:
            seen.append(q)
    return seen


def ensure_campaign_banner(db: Session, campaign: Campaign) -> None:
    """If a campaign has no uploaded banner, fetch a topic-relevant stock photo,
    re-host it, and store it as the banner. Best-effort — never raises."""
    if campaign.banner_url:
        return
    try:
        from app.integrations import stock_images
        from app.services import thumbnails

        url = None
        for query in _topic_candidates(campaign):
            url = stock_images.search_topic_image(query)
            if url:
                break
        if not url:
            return
        # Re-host so we don't depend on the source CDN; fall back to the direct
        # (hotlink-stable) URL when storage isn't configured.
        campaign.banner_url = thumbnails.rehost(url, "campaign_banner", campaign.id) or url
        db.commit()
    except Exception:  # noqa: BLE001 - a banner is cosmetic; never fail the caller
        db.rollback()


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
    data = _drop_unset_defaults(dict(data))
    _validate_flow_fields(data)
    milestones_provided = "bonus_milestones" in data
    bonus_milestones = data.pop("bonus_milestones", None) or []
    new_mode = c.mode
    new_brief = data.get("brief_script", c.brief_script)
    new_drive = data.get("content_drive_url", c.content_drive_url)
    _check_mode_content(new_mode, new_brief, new_drive)
    # Revalidate money invariants before they reach the DB CHECK constraints
    # (otherwise a bad value would surface as a generic 500).
    # cpm_rate only matters for CPM/mixed (mirror create_campaign) — fixed /
    # per_hour / per_post may legitimately be 0.
    _eff_ptype = data.get("payment_type", c.payment_type)
    if data.get("cpm_rate") is not None and data["cpm_rate"] <= 0 and _eff_ptype in (None, "cpm", "mixed"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cpm_rate must be positive")
    # Validate the effective (post-merge) payment amount so an edit can't leave a
    # fixed/per_post/per_hour campaign with a null/zero rate that pays $0.
    _validate_payment_amount(
        _eff_ptype,
        data.get("fixed_amount", c.fixed_amount),
        data.get("per_post_amount", c.per_post_amount),
        data.get("hourly_rate", c.hourly_rate),
    )
    _validate_ranges(data)
    if data.get("budget") is not None and data["budget"] <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "budget must be positive")
    # The router passes model_dump(exclude_unset=True), so a field being present
    # means the admin sent it — apply it even when null (lets banner_url,
    # description, end date, etc. be cleared). Omitted fields stay untouched.
    # Required (NOT NULL) columns can't be cleared — ignore an explicit null for
    # them rather than 500 on the DB constraint; everything else may be nulled.
    _never_null = {"name", "mode", "cpm_rate", "budget"}
    for field, value in data.items():
        if field == "client_id":  # handled below (needs UUID parsing)
            continue
        if value is None and field in _never_null:
            continue
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
    # A draft may have been created without a banner — fetch topic art now that
    # it's going live (no-op if the admin uploaded one).
    ensure_campaign_banner(db, c)
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


def get_campaign_for_creator(db: Session, slug: str, creator_id: uuid.UUID) -> Campaign:
    """Campaign detail for a creator. Active campaigns are visible to anyone; a
    campaign that has since been closed/paused stays visible to a creator who
    already joined it, so they can still read the brief and finish in-flight
    submissions instead of hitting a bare 404. Archived campaigns stay hidden."""
    c = db.scalar(select(Campaign).where(Campaign.slug == slug))
    if c is None or c.status == "archived":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    if c.status != "active" and not creator_has_joined(db, c.id, creator_id):
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


def creator_is_accepted(db: Session, campaign_id: uuid.UUID, creator_id: uuid.UUID) -> bool:
    """True once an admin has approved the creator into the campaign
    (accepted_at set). Gates the creator-side submit UI (two-gate model)."""
    return db.scalar(
        select(CampaignParticipation.accepted_at).where(
            CampaignParticipation.campaign_id == campaign_id,
            CampaignParticipation.creator_id == creator_id,
            CampaignParticipation.removed_at.is_(None),
        )
    ) is not None


def join_campaign(db: Session, creator_id: uuid.UUID, slug: str,
                  require_profile: bool = True) -> CampaignParticipation:
    # Applying to a campaign requires a minimally-complete profile (name + at
    # least one social) — SideShift-style "complete your profile" wall. This is
    # the AUTHENTICATED creator path only; the public email+URL submit flow
    # passes require_profile=False because a stranger has no profile yet.
    from app.services import socials_verify

    if require_profile:
        eligible, _missing = socials_verify.apply_eligibility(db, creator_id)
        if not eligible:
            # String detail (not an object) so the frontend matches it directly
            # and opens the "complete your profile" popup on this exact value.
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="profile_incomplete")

    # A creator an admin removed must not be able to walk straight back in.
    creator = db.get(Creator, creator_id)
    if creator is not None and creator.tracking_disabled:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This account can no longer join campaigns.",
        )
    # A creator flagged suspicious is frozen from new activity while under review.
    if creator is not None and creator.is_suspicious:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This account is under review and can't join campaigns right now.",
        )

    # Distinguish "closed" from "never existed" so the client can show a clear
    # message instead of a bare 404 when a creator tries to join after close.
    campaign = db.scalar(select(Campaign).where(Campaign.slug == slug))
    if campaign is None or campaign.status == "archived":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    if campaign.status != "active":
        raise HTTPException(status.HTTP_409_CONFLICT, "This campaign is closed and no longer accepting entries.")
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
        # No approval gate (Rev2): a creator who already joined but predates this
        # change may still be un-accepted — lift the gate retroactively so they
        # can submit immediately, matching the new no-request behaviour. Also
        # advance status off "joined" so the admin Applicants pipeline shows
        # them under "Accepted", not "New" (they need no review under Rev2).
        if existing.accepted_at is None:
            existing.accepted_at = _now()
        if existing.status == "joined":
            existing.status = "accepted"
        db.commit()
        return existing
    # No approval gate (Rev2): entering a campaign accepts the creator straight
    # away so they can submit without waiting on an admin. Admins still see who
    # joined and can remove/decline (which clears accepted_at) if needed. status
    # starts at "accepted" (not the default "joined") so the Applicants pipeline
    # buckets them correctly — submissions never mutate participation.status.
    part = CampaignParticipation(
        campaign_id=campaign.id, creator_id=creator_id, accepted_at=_now(), status="accepted"
    )
    db.add(part)
    db.commit()
    db.refresh(part)
    # If an admin had invited this creator, close the open invite now.
    try:
        from app.services import campaign_invites
        campaign_invites.mark_accepted_on_join(db, campaign.id, creator_id)
    except Exception:  # noqa: BLE001 - the join succeeded; invite bookkeeping is best-effort
        pass
    # Generate + send their Campaign Participation Agreement.
    try:
        from app.services import contracts
        contracts.generate_for_creator(db, campaign.id, creator_id)
    except Exception:  # noqa: BLE001 - the join succeeded; contract is best-effort
        pass
    return part


def _creator_campaign_rows(db: Session, creator_id: uuid.UUID, rows) -> list[dict]:
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


def list_creator_campaigns(db: Session, creator_id: uuid.UUID) -> list[dict]:
    """Every campaign this creator applied to / joined, newest first, with their
    application status and how many videos they've submitted to it."""
    rows = db.execute(
        select(CampaignParticipation, Campaign)
        .join(Campaign, Campaign.id == CampaignParticipation.campaign_id)
        .where(CampaignParticipation.creator_id == creator_id)
        .order_by(CampaignParticipation.joined_at.desc())
    ).all()
    return _creator_campaign_rows(db, creator_id, rows)


def list_creator_invited_campaigns(db: Session, creator_id: uuid.UUID) -> list[dict]:
    """Campaigns an admin personally invited this creator to — identified by a
    CampaignInvite row carrying this creator_id (that's what the admin
    "invite creators" action writes). Admin invites auto-accept the creator, so
    these ALSO show under My Campaigns; the invite record is what marks a campaign
    as invited-by-Lumina here. Ordered newest-invite first."""
    rows = db.execute(
        select(CampaignParticipation, Campaign)
        .join(Campaign, Campaign.id == CampaignParticipation.campaign_id)
        .where(
            CampaignParticipation.creator_id == creator_id,
            CampaignParticipation.removed_at.is_(None),
            exists().where(
                and_(
                    CampaignInvite.campaign_id == Campaign.id,
                    CampaignInvite.creator_id == creator_id,
                    CampaignInvite.revoked_at.is_(None),
                )
            ),
        )
        .order_by(CampaignParticipation.accepted_at.desc().nullslast(), CampaignParticipation.joined_at.desc())
    ).all()
    return _creator_campaign_rows(db, creator_id, rows)


def list_creator_invited_campaign_models(db: Session, creator_id: uuid.UUID) -> list[Campaign]:
    """Same set as list_creator_invited_campaigns, but the Campaign ORM objects —
    so the /invited endpoint can serialize them exactly like the Explore grid
    (thumbnail, brand, 'Joined' badge, click-through to the campaign)."""
    return list(
        db.execute(
            select(Campaign)
            .join(
                CampaignParticipation,
                and_(
                    CampaignParticipation.campaign_id == Campaign.id,
                    CampaignParticipation.creator_id == creator_id,
                    CampaignParticipation.removed_at.is_(None),
                ),
            )
            .where(
                exists().where(
                    and_(
                        CampaignInvite.campaign_id == Campaign.id,
                        CampaignInvite.creator_id == creator_id,
                        CampaignInvite.revoked_at.is_(None),
                    )
                )
            )
            .order_by(CampaignParticipation.accepted_at.desc().nullslast(), CampaignParticipation.joined_at.desc())
        ).scalars().all()
    )
