"""Creator profile logic. Completion is SERVER-OWNED — only recompute_completion()
sets creator_profiles.completed_at. Never trust a client value for it."""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import _now
from app.models import CreatorProfile, PortfolioItem, SocialAccount, StorageObject
from app.services import geo, urls


def _require_owned_object(db: Session, creator_id: uuid.UUID, object_id, purpose: str) -> StorageObject:
    """Guard against IDOR: a storage object may only be attached by its owner,
    must be finalized, and must match the expected purpose."""
    try:
        oid = object_id if isinstance(object_id, uuid.UUID) else uuid.UUID(str(object_id))
    except (ValueError, TypeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid storage object id")
    obj = db.get(StorageObject, oid)
    if obj is None or obj.owner_creator_id != creator_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upload not found")
    if obj.purpose != purpose:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload has the wrong purpose")
    if obj.status != "finalized":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload is not finalized yet")
    return obj

_PLATFORMS = {"instagram", "tiktok", "youtube", "twitter", "facebook"}
_GENDERS = {"male", "female", "non_binary", "other", "prefer_not_to_say"}
_PAYOUT_METHODS = {"paypal", "solana", "whop"}
_CREATOR_TYPES = {"ugc", "influencer", "both"}
_EDUCATION = {"in_high_school", "in_college", "graduated", "grad_school", "no_college", "na"}
# Nothing is mandatory — demographics (DOB/gender/country/ethnicity/language)
# and socials/portfolio are dashboard incentives, not a signup gate. Kept as a
# tuple (not deleted outright) since recompute_completion() still reports
# `completed`/`missing` for the UI to show encouragement copy against.
_REQUIRED_FIELDS: tuple[str, ...] = ()


def get_or_create_profile(db: Session, creator_id: uuid.UUID) -> CreatorProfile:
    prof = db.scalar(select(CreatorProfile).where(CreatorProfile.creator_id == creator_id))
    if prof is None:
        prof = CreatorProfile(creator_id=creator_id)
        db.add(prof)
        db.commit()
        db.refresh(prof)
    return prof


def update_profile(db: Session, creator_id: uuid.UUID, data: dict) -> CreatorProfile:
    prof = get_or_create_profile(db, creator_id)
    if data.get("gender") is not None and data["gender"] not in _GENDERS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid gender")
    if data.get("payout_method") not in (None, "") and data["payout_method"] not in _PAYOUT_METHODS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid payout method")
    if data.get("creator_type") not in (None, "") and data["creator_type"] not in _CREATOR_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid creator type")
    if data.get("education") not in (None, "") and data["education"] not in _EDUCATION:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid education")
    # Real-place validation — no made-up country/city.
    if data.get("country") not in (None, "") and not geo.is_valid_country(data["country"]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please choose a real country from the list.")
    if data.get("city") not in (None, ""):
        country_for_city = data.get("country") or prof.country
        if country_for_city and not geo.city_exists(data["city"].strip(), country_for_city):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"We couldn't find “{data['city'].strip()}” in {country_for_city}. Enter a real city.",
            )
    if data.get("avatar_object_id") is not None:
        _require_owned_object(db, creator_id, data["avatar_object_id"], "avatar")
    for field in ("display_name", "creator_type", "bio", "date_of_birth", "gender", "ethnicity", "education",
                  "primary_language", "country", "city", "avatar_object_id",
                  "payout_method", "payout_address",
                  "payout_paypal", "payout_solana", "payout_whop"):
        if field in data and data[field] is not None:
            setattr(prof, field, data[field])
    if data.get("languages") is not None:
        prof.languages = data["languages"]
    # Keep payout_address as the resolved address for the selected method so
    # the admin payout prefill + claim gate (which read payout_address) stay
    # correct regardless of which per-method field the creator just edited.
    if prof.payout_method in _PAYOUT_METHODS:
        resolved = getattr(prof, f"payout_{prof.payout_method}", None)
        if resolved:
            prof.payout_address = resolved
    db.commit()
    recompute_completion(db, creator_id)
    return prof


# ---- socials ----
def list_socials(db: Session, creator_id: uuid.UUID):
    return db.scalars(select(SocialAccount).where(SocialAccount.creator_id == creator_id)).all()


def add_social(db: Session, creator_id: uuid.UUID, data: dict) -> SocialAccount:
    platform = data["platform"]
    if platform not in _PLATFORMS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid platform")
    handle = (data.get("handle") or "").lstrip("@").strip()
    if not handle:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Handle is required")
    if data.get("follower_count", 0) < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "follower_count cannot be negative")
    # If they pasted a URL, reject it when it isn't this platform (anti-phishing).
    # Either way we STORE the canonical URL derived from the handle, so the stored
    # link can never disagree with the handle.
    submitted = (data.get("profile_url") or "").strip()
    if submitted and not urls.url_is_platform(platform, submitted):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"That URL isn't a {platform} profile link")
    profile_url = urls.social_profile_url(platform, handle)
    exists = db.scalar(select(SocialAccount).where(
        SocialAccount.creator_id == creator_id,
        SocialAccount.platform == platform,
        SocialAccount.handle == handle,
    ))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "This handle is already added")
    social = SocialAccount(
        creator_id=creator_id, platform=platform, handle=handle,
        profile_url=profile_url, follower_count=data.get("follower_count", 0),
    )
    db.add(social)
    db.commit()
    db.refresh(social)
    recompute_completion(db, creator_id)
    return social


def delete_social(db: Session, creator_id: uuid.UUID, social_id: uuid.UUID) -> None:
    social = db.get(SocialAccount, social_id)
    if social is None or social.creator_id != creator_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Social account not found")
    db.delete(social)
    db.commit()
    recompute_completion(db, creator_id)


# ---- portfolio ----
def list_portfolio(db: Session, creator_id: uuid.UUID):
    return db.scalars(select(PortfolioItem).where(PortfolioItem.creator_id == creator_id)).all()


def add_portfolio(db: Session, creator_id: uuid.UUID, data: dict) -> PortfolioItem:
    if data.get("platform") is not None and data["platform"] not in _PLATFORMS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid platform")

    # Primary path: an uploaded video FILE (stored on R2), distinct from a
    # submission. The playable URL is resolved from the storage object at read
    # time so proxy/presigned URLs stay fresh.
    if data.get("storage_object_id"):
        obj = _require_owned_object(db, creator_id, data["storage_object_id"], "portfolio_video")
        item = PortfolioItem(
            creator_id=creator_id, storage_object_id=obj.id,
            brand_name=data.get("brand_name"), caption=data.get("caption"),
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        recompute_completion(db, creator_id)
        return item

    # Legacy path: an external video LINK (kept so older clients still work).
    video_url = (data.get("video_url") or "").strip()
    if not video_url:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload a video or provide a video link")
    if not urls.is_video_url(video_url):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Link must be a TikTok, Instagram, YouTube, X, or Facebook video/post URL",
        )
    canonical = urls.canonicalize_url(video_url)
    platform = data.get("platform") or urls.detect_platform(video_url)
    # Scrape the real video thumbnail so the card shows the actual frame, not a
    # "Watch on <platform>" placeholder. Best-effort — never blocks the add.
    thumb = data.get("thumbnail_url")
    if not thumb:
        from app.integrations import apify
        try:
            thumb = apify.post_thumbnail(platform, canonical)
        except Exception:  # noqa: BLE001
            thumb = None
    item = PortfolioItem(
        creator_id=creator_id, video_url=canonical,
        thumbnail_url=thumb, brand_name=data.get("brand_name"),
        caption=data.get("caption"), platform=platform,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    recompute_completion(db, creator_id)
    return item


def delete_portfolio(db: Session, creator_id: uuid.UUID, item_id: uuid.UUID) -> None:
    item = db.get(PortfolioItem, item_id)
    if item is None or item.creator_id != creator_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portfolio item not found")
    db.delete(item)
    db.commit()
    recompute_completion(db, creator_id)


# ---- completion (server-owned) ----
# Not a gate — nothing here blocks joining a campaign or reaching the
# dashboard. `missing` is reported purely so the frontend can render
# encouragement cards ("add a social to get matched to more campaigns").
def recompute_completion(db: Session, creator_id: uuid.UUID) -> tuple[bool, list[str]]:
    prof = get_or_create_profile(db, creator_id)
    missing: list[str] = [f for f in _REQUIRED_FIELDS if getattr(prof, f) in (None, "")]
    n_social = db.scalar(select(func.count()).select_from(SocialAccount).where(
        SocialAccount.creator_id == creator_id))
    n_portfolio = db.scalar(select(func.count()).select_from(PortfolioItem).where(
        PortfolioItem.creator_id == creator_id))
    if not n_social:
        missing.append("social_account")
    if not n_portfolio:
        missing.append("portfolio_item")
    complete = not missing
    prof.completed_at = _now() if complete else None
    db.commit()
    return complete, missing


# ---- apply-readiness (this IS a gate — join_campaign requires it) ----
# The whole profile must be filled before a creator can apply to a campaign:
# About, Socials (>=1 VERIFIED), Videos, Details, Payment. Order matters — the
# "complete your profile" popup routes the creator to `next_section`.
# Payment is NOT a join requirement — creators can set up "where to send earnings"
# later. Required to apply: About, Socials (Instagram AND TikTok verified),
# Videos (>=1), Details (birthday + real country + real city).
SECTION_ORDER = ["about", "socials", "videos", "details"]


def _verified(db: Session, creator_id: uuid.UUID, platform: str) -> bool:
    return db.scalar(select(SocialAccount.id).where(
        SocialAccount.creator_id == creator_id, SocialAccount.platform == platform,
        SocialAccount.is_verified.is_(True))) is not None


def profile_completeness(db: Session, creator_id: uuid.UUID) -> dict:
    prof = get_or_create_profile(db, creator_id)
    n_portfolio = db.scalar(select(func.count()).select_from(PortfolioItem).where(
        PortfolioItem.creator_id == creator_id))
    sections = {
        "about": bool((prof.creator_type or "").strip() and (prof.display_name or "").strip()),
        "socials": _verified(db, creator_id, "instagram") and _verified(db, creator_id, "tiktok"),
        "videos": bool(n_portfolio),
        "details": bool(prof.date_of_birth and (prof.country or "").strip() and (prof.city or "").strip()),
    }
    next_section = next((s for s in SECTION_ORDER if not sections[s]), None)
    return {"complete": next_section is None, "sections": sections, "next_section": next_section}
