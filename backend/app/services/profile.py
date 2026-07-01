"""Creator profile logic. Completion is SERVER-OWNED — only recompute_completion()
sets creator_profiles.completed_at. Never trust a client value for it."""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import _now
from app.models import CreatorProfile, PortfolioItem, SocialAccount

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
    if data["platform"] not in _PLATFORMS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid platform")
    if data.get("follower_count", 0) < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "follower_count cannot be negative")
    exists = db.scalar(select(SocialAccount).where(
        SocialAccount.creator_id == creator_id,
        SocialAccount.platform == data["platform"],
        SocialAccount.handle == data["handle"],
    ))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "This handle is already added")
    social = SocialAccount(
        creator_id=creator_id, platform=data["platform"], handle=data["handle"],
        profile_url=data.get("profile_url"), follower_count=data.get("follower_count", 0),
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
    item = PortfolioItem(
        creator_id=creator_id, storage_object_id=uuid.UUID(data["storage_object_id"]),
        thumbnail_url=data.get("thumbnail_url"), brand_name=data.get("brand_name"),
        caption=data.get("caption"), platform=data.get("platform"),
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
