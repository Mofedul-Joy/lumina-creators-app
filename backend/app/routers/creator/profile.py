"""Creator profile: self-scoped CRUD for profile, socials, portfolio, + completion gate."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_creator
from app.db.session import get_db
from app.integrations import storage
from app.models import Creator, CreatorProfile, StorageObject
from app.schemas.profile import (
    CompletionOut,
    PortfolioIn,
    PortfolioOut,
    ProfileIn,
    ProfileOut,
    SocialIn,
    SocialOut,
)
from app.services import profile as svc

router = APIRouter(prefix="/profile", tags=["creator-profile"])


def _avatar_url(db: Session, prof: CreatorProfile) -> str | None:
    if not prof.avatar_object_id:
        return None
    obj = db.get(StorageObject, prof.avatar_object_id)
    return storage.object_public_url(obj.object_key) if obj else None


def _profile_out(db: Session, prof: CreatorProfile, complete: bool, missing: list[str]) -> ProfileOut:
    return ProfileOut(
        display_name=prof.display_name, bio=prof.bio, date_of_birth=prof.date_of_birth,
        gender=prof.gender, ethnicity=prof.ethnicity, primary_language=prof.primary_language,
        languages=prof.languages or [], country=prof.country, city=prof.city,
        avatar_object_id=str(prof.avatar_object_id) if prof.avatar_object_id else None,
        avatar_url=_avatar_url(db, prof),
        payout_method=prof.payout_method, payout_address=prof.payout_address,
        payout_paypal=prof.payout_paypal, payout_solana=prof.payout_solana,
        payout_whop=prof.payout_whop,
        completed=complete, missing=missing,
    )


@router.get("", response_model=ProfileOut)
def get_profile(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    prof = svc.get_or_create_profile(db, current.id)
    complete, missing = svc.recompute_completion(db, current.id)
    return _profile_out(db, prof, complete, missing)


@router.put("", response_model=ProfileOut)
def update_profile(body: ProfileIn, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    prof = svc.update_profile(db, current.id, body.model_dump(exclude_unset=True))
    complete, missing = svc.recompute_completion(db, current.id)
    return _profile_out(db, prof, complete, missing)


@router.get("/completion", response_model=CompletionOut)
def completion(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    complete, missing = svc.recompute_completion(db, current.id)
    return CompletionOut(completed=complete, missing=missing)


# ---- socials ----
def _social_out(s) -> SocialOut:
    return SocialOut(id=str(s.id), platform=s.platform, handle=s.handle,
                     profile_url=s.profile_url, follower_count=s.follower_count, is_verified=s.is_verified)


@router.get("/socials", response_model=list[SocialOut])
def list_socials(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    return [_social_out(s) for s in svc.list_socials(db, current.id)]


@router.post("/socials", response_model=SocialOut)
def add_social(body: SocialIn, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    return _social_out(svc.add_social(db, current.id, body.model_dump()))


@router.delete("/socials/{social_id}", status_code=204)
def delete_social(social_id: uuid.UUID, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    svc.delete_social(db, current.id, social_id)


# ---- portfolio ----
def _portfolio_out(p) -> PortfolioOut:
    return PortfolioOut(id=str(p.id), video_url=p.video_url,
                        thumbnail_url=p.thumbnail_url, brand_name=p.brand_name,
                        caption=p.caption, platform=p.platform)


@router.get("/portfolio", response_model=list[PortfolioOut])
def list_portfolio(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    return [_portfolio_out(p) for p in svc.list_portfolio(db, current.id)]


@router.post("/portfolio", response_model=PortfolioOut)
def add_portfolio(body: PortfolioIn, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    return _portfolio_out(svc.add_portfolio(db, current.id, body.model_dump()))


@router.delete("/portfolio/{item_id}", status_code=204)
def delete_portfolio(item_id: uuid.UUID, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    svc.delete_portfolio(db, current.id, item_id)
