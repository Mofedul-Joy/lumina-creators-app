"""Admin creator database: filterable list + drill-down. Reads profile/socials/portfolio."""
from __future__ import annotations

import uuid
from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import exists, or_, select
from sqlalchemy.orm import Session

from app.integrations import storage
from app.models import Creator, CreatorProfile, PortfolioItem, SocialAccount, StorageObject


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
                  min_followers=None, social=None, completed_only=False, limit=50, offset=0):
    stmt = select(Creator).outerjoin(CreatorProfile, CreatorProfile.creator_id == Creator.id)
    P = CreatorProfile
    if q:
        # match the email's local part only — '%ma%' must not hit every '@gmail.com'
        from sqlalchemy import func as sqlfunc
        stmt = stmt.where(or_(
            sqlfunc.split_part(Creator.email, "@", 1).ilike(f"%{q}%"),
            P.display_name.ilike(f"%{q}%"),
        ))
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

    out = []
    for c in creators:
        prof = profiles.get(c.id)
        socials = socials_by_creator.get(c.id, [])
        out.append({
            "id": str(c.id), "email": c.email,
            "display_name": prof.display_name if prof else None,
            "avatar_url": avatars.get(c.id),
            "gender": prof.gender if prof else None,
            "country": prof.country if prof else None,
            "primary_language": prof.primary_language if prof else None,
            "total_followers": sum(s.follower_count for s in socials),
            "platforms": sorted({s.platform for s in socials}),
            "completed": bool(prof and prof.completed_at),
        })
    return out


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
        "socials": [
            {"platform": s.platform, "handle": s.handle, "profile_url": s.profile_url, "follower_count": s.follower_count}
            for s in socials
        ],
        "portfolio": [
            {"id": str(p.id), "brand_name": p.brand_name, "caption": p.caption, "platform": p.platform}
            for p in portfolio
        ],
    }
