"""Creator profile logic. Completion is SERVER-OWNED — only recompute_completion()
sets creator_profiles.completed_at. Never trust a client value for it."""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import _now
from app.models import CreatorProfile, PortfolioItem, SocialAccount, StorageObject
from app.services import urls


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
# Fields (beyond >=1 social and >=1 portfolio item) required for a complete profile.
_REQUIRED_FIELDS = ("display_name", "date_of_birth", "gender", "primary_language", "country")


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
    if data.get("avatar_object_id") is not None:
        _require_owned_object(db, creator_id, data["avatar_object_id"], "avatar")
    for field in ("display_name", "bio", "date_of_birth", "gender", "ethnicity",
                  "primary_language", "country", "city", "avatar_object_id"):
        if field in data and data[field] is not None:
            setattr(prof, field, data[field])
    if data.get("languages") is not None:
        prof.languages = data["languages"]
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
    # Verify the profile URL genuinely points at this platform (anti-phishing),
    # or build the canonical one from the handle when they leave it blank.
    profile_url = (data.get("profile_url") or "").strip()
    if profile_url:
        if not urls.url_is_platform(platform, profile_url):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"That URL isn't a {platform} profile link")
    else:
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
    # Portfolio is now a LINK to the creator's best video, not an uploaded file —
    # keeps the DB light and onboarding fast.
    video_url = (data.get("video_url") or "").strip()
    if not video_url:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A video link is required")
    if urls.detect_platform(video_url) is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Link must be a TikTok, Instagram, YouTube, X, or Facebook video URL",
        )
    item = PortfolioItem(
        creator_id=creator_id, video_url=urls.canonicalize_url(video_url),
        thumbnail_url=data.get("thumbnail_url"), brand_name=data.get("brand_name"),
        caption=data.get("caption"), platform=data.get("platform") or urls.detect_platform(video_url),
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
        # ponytail: counts any portfolio row; gate on storage_objects.status='finalized' once M3 uploads land
        missing.append("portfolio_item")
    complete = not missing
    prof.completed_at = _now() if complete else None
    db.commit()
    return complete, missing
