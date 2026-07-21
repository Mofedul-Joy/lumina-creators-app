"""Admin creator database: filterable list + drill-down. Reads profile/socials/portfolio."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session

from app.integrations import storage
from app.models import (
    Campaign,
    CampaignParticipation,
    Creator,
    CreatorExperience,
    CreatorProfile,
    Payout,
    PortfolioItem,
    SocialAccount,
    StorageObject,
    Submission,
)
from app.services import audit
from app.services.profile import EXPERIENCE_KINDS
# Gamification formulas now live in app.services.gamification (Feature 7) —
# re-exported here under their original private names so every call site in
# this file (and any external importer) keeps working unchanged.
from app.services.gamification import compute_awards as _awards_for
from app.services.gamification import compute_rank as _rank_for_xp
from app.services.gamification import compute_xp as _xp_for


def _avatar_urls(db: Session, profiles) -> dict:
    """Map creator_id -> public avatar URL (batched)."""
    obj_ids = {p.avatar_object_id for p in profiles if getattr(p, "avatar_object_id", None)}
    if not obj_ids:
        return {}
    keys = {o.id: o.object_key for o in db.scalars(select(StorageObject).where(StorageObject.id.in_(obj_ids))).all()}
    out = {}
    for p in profiles:
        oid = getattr(p, "avatar_object_id", None)
        if oid and oid in keys:
            out[p.creator_id] = storage.object_public_url(keys[oid])
    return out


def _dob_bounds(age_min: int | None, age_max: int | None):
    today = date.today()
    hi = today - timedelta(days=int(age_min * 365.25)) if age_min is not None else None       # newest DOB
    lo = today - timedelta(days=int((age_max + 1) * 365.25)) if age_max is not None else None  # oldest DOB
    return lo, hi


def list_creators(db: Session, *, q=None, gender=None, ethnicity=None, primary_language=None,
                  country=None, city=None, age_min=None, age_max=None, platform=None,
                  min_followers=None, social=None, niches=None,
                  completed_only=False, limit=50, offset=0):
    stmt = select(Creator).outerjoin(CreatorProfile, CreatorProfile.creator_id == Creator.id)
    P = CreatorProfile
    if q:
        stmt = stmt.where(or_(Creator.email.ilike(f"%{q}%"), P.display_name.ilike(f"%{q}%")))
    if gender:
        stmt = stmt.where(P.gender == gender)
    if ethnicity:
        stmt = stmt.where(P.ethnicity.ilike(f"%{ethnicity}%"))
    if primary_language:
        stmt = stmt.where(P.primary_language.ilike(f"%{primary_language}%"))
    if country:
        stmt = stmt.where(P.country.ilike(f"%{country}%"))
    if city:
        stmt = stmt.where(P.city.ilike(f"%{city}%"))
    if completed_only:
        stmt = stmt.where(P.completed_at.is_not(None))
    if niches:
        stmt = stmt.where(P.niches.overlap(list(niches)))
    lo, hi = _dob_bounds(age_min, age_max)
    if lo is not None:
        stmt = stmt.where(P.date_of_birth >= lo)
    if hi is not None:
        stmt = stmt.where(P.date_of_birth <= hi)
    if platform or min_followers is not None:
        cond = SocialAccount.creator_id == Creator.id
        if platform:
            cond = cond & (SocialAccount.platform == platform)
        if min_followers is not None:
            cond = cond & (SocialAccount.follower_count >= min_followers)
        stmt = stmt.where(exists().where(cond))
    if social and social.strip():
        s = f"%{social.strip()}%"
        stmt = stmt.where(exists().where(
            (SocialAccount.creator_id == Creator.id)
            & (SocialAccount.profile_url.ilike(s) | SocialAccount.handle.ilike(s))
        ))
    stmt = stmt.order_by(Creator.created_at.desc()).limit(min(limit, 500)).offset(offset)

    creators = db.scalars(stmt).all()
    ids = [c.id for c in creators]
    if not ids:
        return []

    # Batch profile + socials in 2 queries (not 2*N) — the list is served from a
    # remote DB, so N+1 here made the admin dashboard multi-second slow.
    profiles = {
        p.creator_id: p
        for p in db.scalars(select(CreatorProfile).where(CreatorProfile.creator_id.in_(ids))).all()
    }
    socials_by_creator: dict[uuid.UUID, list[SocialAccount]] = {cid: [] for cid in ids}
    for s in db.scalars(select(SocialAccount).where(SocialAccount.creator_id.in_(ids))).all():
        socials_by_creator[s.creator_id].append(s)
    avatars = _avatar_urls(db, profiles.values())

    # Batch aggregate views/earnings per creator for the rank badge + stat chips
    # on the list cards (Feature 2) — one query, not N.
    agg_rows = db.execute(
        select(
            Submission.creator_id,
            func.coalesce(func.sum(Submission.views), 0),
            func.coalesce(func.sum(Submission.estimated_amount), 0),
            func.count(Submission.id),
        )
        .where(
            Submission.creator_id.in_(ids),
            Submission.verification_status == "verified",
        )
        .group_by(Submission.creator_id)
    ).all()
    agg_by_creator = {cid: {"views": int(v), "earned": Decimal(e), "posts": int(c)} for cid, v, e, c in agg_rows}

    # Campaigns joined (active count) per creator — one grouped query.
    camp_total: dict[uuid.UUID, int] = {}
    camp_active: dict[uuid.UUID, int] = {}
    for cid, cstatus, cnt in db.execute(
        select(CampaignParticipation.creator_id, Campaign.status, func.count())
        .join(Campaign, Campaign.id == CampaignParticipation.campaign_id)
        .where(CampaignParticipation.creator_id.in_(ids), CampaignParticipation.removed_at.is_(None))
        .group_by(CampaignParticipation.creator_id, Campaign.status)
    ).all():
        camp_total[cid] = camp_total.get(cid, 0) + int(cnt)
        if cstatus == "active":
            camp_active[cid] = camp_active.get(cid, 0) + int(cnt)

    # Post activity in the last 7 days — posts + distinct days posted (drives the
    # SideShift-style "X/5 days" weekly dots).
    since = datetime.now(timezone.utc) - timedelta(days=7)
    recent_by_creator: dict[uuid.UUID, dict] = {}
    for cid, posts, days in db.execute(
        select(
            Submission.creator_id,
            func.count(Submission.id),
            func.count(func.distinct(func.date(Submission.created_at))),
        )
        .where(Submission.creator_id.in_(ids), Submission.created_at >= since)
        .group_by(Submission.creator_id)
    ).all():
        recent_by_creator[cid] = {"posts": int(posts), "days": int(days)}

    out = []
    for c in creators:
        prof = profiles.get(c.id)
        socials = socials_by_creator.get(c.id, [])
        a = agg_by_creator.get(c.id, {"views": 0, "earned": Decimal("0"), "posts": 0})
        streak_days = prof.streak_days if prof else 0
        xp = (prof.xp if prof and prof.xp else 0) or _xp_for(a["views"], a["posts"], streak_days)
        rank = (prof.rank if prof else None) or _rank_for_xp(xp)
        out.append({
            "id": str(c.id), "email": c.email,
            "display_name": prof.display_name if prof else None,
            "avatar_url": avatars.get(c.id),
            "gender": prof.gender if prof else None,
            "country": prof.country if prof else None,
            "primary_language": prof.primary_language if prof else None,
            "total_followers": sum((s.follower_count or 0) for s in socials),
            "platforms": sorted({s.platform for s in socials}),
            "completed": bool(prof and prof.completed_at),
            "is_suspicious": c.is_suspicious,
            "rank": rank,
            "total_views": a["views"],
            "total_earned": a["earned"],
            "status": c.status,
            "accounts_count": len(socials),
            "campaigns_total": camp_total.get(c.id, 0),
            "campaigns_active": camp_active.get(c.id, 0),
            "posts_7d": recent_by_creator.get(c.id, {}).get("posts", 0),
            "days_active_7d": recent_by_creator.get(c.id, {}).get("days", 0),
            "created_at": c.created_at,
        })
    return out


def set_suspicious(db: Session, creator_id: uuid.UUID, flagged: bool,
                   admin_id: uuid.UUID | None = None) -> Creator:
    """Soft fraud flag on the whole account — a warning signal, not a suspend.
    Never returned to creator or client API users (admin-only field)."""
    c = db.get(Creator, creator_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Creator not found")
    c.is_suspicious = flagged
    audit.log(db, actor_admin_id=admin_id, entity_type="creator", entity_id=c.id,
             action="creator.flag_suspicious" if flagged else "creator.unflag_suspicious")
    db.commit()
    db.refresh(c)
    return c


def get_creator_detail(db: Session, creator_id: uuid.UUID) -> dict:
    c = db.get(Creator, creator_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Creator not found")
    prof = db.scalar(select(CreatorProfile).where(CreatorProfile.creator_id == c.id))
    socials = db.scalars(select(SocialAccount).where(SocialAccount.creator_id == c.id)).all()
    portfolio = db.scalars(select(PortfolioItem).where(PortfolioItem.creator_id == c.id)).all()
    return {
        "id": str(c.id), "email": c.email,
        "display_name": prof.display_name if prof else None,
        "avatar_url": _avatar_urls(db, [prof]).get(c.id) if prof else None,
        "bio": prof.bio if prof else None,
        "date_of_birth": prof.date_of_birth if prof else None,
        "gender": prof.gender if prof else None,
        "ethnicity": prof.ethnicity if prof else None,
        "primary_language": prof.primary_language if prof else None,
        "languages": (prof.languages if prof else []) or [],
        "country": prof.country if prof else None,
        "city": prof.city if prof else None,
        "completed": bool(prof and prof.completed_at),
        "is_suspicious": c.is_suspicious,
        "payout_method": prof.payout_method if prof else None,
        "payout_address": prof.payout_address if prof else None,
        "payout_paypal": prof.payout_paypal if prof else None,
        "payout_solana": prof.payout_solana if prof else None,
        "payout_whop": prof.payout_whop if prof else None,
        "socials": [
            {"platform": s.platform, "handle": s.handle, "profile_url": s.profile_url, "follower_count": s.follower_count}
            for s in socials
        ],
        "portfolio": [
            {
                "id": str(p.id),
                "brand_name": p.brand_name,
                "caption": p.caption,
                "platform": p.platform,
                "video_url": p.video_url,
                "thumbnail_url": p.thumbnail_url,
                "is_top_content": p.is_top_content,
                "views": p.views,
                "likes": p.likes,
            }
            for p in portfolio
        ],
    }


def _age(dob) -> int | None:
    if not dob:
        return None
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    # Legacy/dirty rows (e.g. a future date_of_birth stored before the validator
    # existed) would otherwise render a nonsensical negative age on the admin card.
    return age if age >= 0 else None


def get_creator_rich_detail(db: Session, creator_id: uuid.UUID) -> dict:
    """SideShift-style rich detail card (Feature 2, BUILD_SPEC.md §3.1 + §3.9).
    Superset of `get_creator_detail`: adds gamification (rank/xp/streak/awards),
    niches, experiences, and a recent-submissions video reel. Rank/xp/awards are
    computed on the fly whenever the stored columns are unset, so existing rows
    keep working without a backfill.
    """
    c = db.get(Creator, creator_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Creator not found")
    prof = db.scalar(select(CreatorProfile).where(CreatorProfile.creator_id == c.id))
    socials = db.scalars(select(SocialAccount).where(SocialAccount.creator_id == c.id)).all()
    portfolio = db.scalars(
        select(PortfolioItem)
        .where(PortfolioItem.creator_id == c.id)
        .order_by(PortfolioItem.created_at.asc())
    ).all()
    experiences = db.scalars(
        select(CreatorExperience)
        .where(CreatorExperience.creator_id == c.id)
        .order_by(CreatorExperience.created_at.desc())
    ).all()

    agg_row = db.execute(
        select(
            func.coalesce(func.sum(Submission.views), 0),
            func.coalesce(func.sum(Submission.estimated_amount), 0),
            func.count(Submission.id),
            func.coalesce(func.sum(Submission.likes), 0),
            func.coalesce(func.sum(Submission.comments), 0),
            func.coalesce(func.sum(Submission.shares), 0),
        ).where(
            Submission.creator_id == c.id,
            Submission.verification_status == "verified",
        )
    ).first()
    total_views = int(agg_row[0]) if agg_row else 0
    total_earned = Decimal(agg_row[1]) if agg_row else Decimal("0")
    total_posts = int(agg_row[2]) if agg_row else 0
    # Money actually paid out — sums Payout rows (all payment types), NOT
    # estimated_amount which only covers CPM. Without this a creator paid on a
    # fixed/per-post campaign sees $0 on their own dashboard (admin↔creator desync).
    total_paid = Decimal(db.scalar(
        select(func.coalesce(func.sum(Payout.amount), 0)).where(
            Payout.creator_id == c.id, Payout.status == "paid"
        )
    ) or 0)
    total_likes = int(agg_row[3]) if agg_row else 0
    interactions = total_likes + int(agg_row[4] or 0) + int(agg_row[5] or 0) if agg_row else 0
    engagement_rate = round(interactions / total_views * 100, 1) if total_views else 0.0

    # Show the creator's campaign uploads (verified + still-pending); exclude
    # only rejected. NB: the enum is pending/verified/rejected — an earlier
    # build filtered on non-existent "approved"/"reviewed" values, which made
    # this query error out on Postgres.
    recent_subs = db.scalars(
        select(Submission)
        .where(
            Submission.creator_id == c.id,
            Submission.verification_status.in_(("verified", "pending")),
        )
        .order_by(Submission.created_at.desc())
        .limit(12)
    ).all()

    # Map each submission's campaign to its name so the admin can see which
    # video was uploaded for which campaign.
    camp_ids = {s.campaign_id for s in recent_subs}
    camp_names: dict = {}
    if camp_ids:
        camp_names = {
            cid: name
            for cid, name in db.execute(
                select(Campaign.id, Campaign.name).where(Campaign.id.in_(camp_ids))
            ).all()
        }

    streak_days = prof.streak_days if prof else 0
    xp = (prof.xp if prof and prof.xp else 0) or _xp_for(total_views, total_posts, streak_days)
    rank = (prof.rank if prof else None) or _rank_for_xp(xp)
    awards = _awards_for(total_posts, total_earned, streak_days, prof.awards if prof else None)

    return {
        "id": str(c.id), "email": c.email,
        "display_name": prof.display_name if prof else None,
        "avatar_url": _avatar_urls(db, [prof]).get(c.id) if prof else None,
        "bio": prof.bio if prof else None,
        "date_of_birth": prof.date_of_birth if prof else None,
        "age": _age(prof.date_of_birth) if prof else None,
        "gender": prof.gender if prof else None,
        "ethnicity": prof.ethnicity if prof else None,
        "education": prof.education if prof else None,
        "primary_language": prof.primary_language if prof else None,
        "languages": (prof.languages if prof else []) or [],
        "country": prof.country if prof else None,
        "city": prof.city if prof else None,
        "completed": bool(prof and prof.completed_at),
        "is_suspicious": c.is_suspicious,
        "rank": rank,
        "xp": xp,
        "streak_days": streak_days,
        "awards": awards,
        "niches": (prof.niches if prof else []) or [],
        "creator_type": prof.creator_type if prof else None,
        "total_views": total_views,
        "total_earned": total_earned,
        "total_paid": total_paid,
        "total_posts": total_posts,
        "total_likes": total_likes,
        "engagement_rate": engagement_rate,
        "socials": [
            {"platform": s.platform, "handle": s.handle, "profile_url": s.profile_url, "follower_count": s.follower_count}
            for s in socials
        ],
        "recent_submissions": [
            {
                "id": str(s.id),
                "post_url": s.post_url,
                "platform": s.platform,
                "views": s.views,
                "likes": s.likes,
                "comments": s.comments,
                "shares": s.shares,
                "thumbnail_url": s.thumbnail_url,
                "campaign_id": str(s.campaign_id),
                "campaign_name": camp_names.get(s.campaign_id),
            }
            for s in recent_subs
        ],
        "experiences": [
            {
                "id": str(e.id), "title": e.title, "org": e.org, "url": e.url,
                "kind_label": EXPERIENCE_KINDS.get(e.kind, e.kind),
                "description": e.description, "platforms": list(e.platforms or []),
                "deliverable": e.deliverable, "niche": e.niche, "work_url": e.work_url,
                "results": e.results, "period": e.period, "created_at": e.created_at,
            }
            for e in experiences
        ],
        "portfolio": [
            {
                "id": str(p.id),
                "brand_name": p.brand_name,
                "caption": p.caption,
                "platform": p.platform,
                "video_url": p.video_url,
                "thumbnail_url": p.thumbnail_url,
                "is_top_content": p.is_top_content,
                "views": p.views,
                "likes": p.likes,
            }
            for p in portfolio
        ],
    }
