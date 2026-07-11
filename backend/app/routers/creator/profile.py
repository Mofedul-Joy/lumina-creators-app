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
    ExperienceIn,
    ExperienceOut,
    PortfolioIn,
    PortfolioOut,
    ProfileIn,
    ProfileOut,
    SocialIn,
    SocialOut,
    SocialVerifyIn,
    SocialVerifyStartOut,
)
from app.services import profile as svc
from app.services import socials_verify as verify_svc

router = APIRouter(prefix="/profile", tags=["creator-profile"])


def _avatar_url(db: Session, prof: CreatorProfile) -> str | None:
    if not prof.avatar_object_id:
        return None
    obj = db.get(StorageObject, prof.avatar_object_id)
    return storage.object_public_url(obj.object_key) if obj else None


def _profile_out(db: Session, prof: CreatorProfile, complete: bool, missing: list[str]) -> ProfileOut:
    return ProfileOut(
        display_name=prof.display_name, phone=prof.phone,
        creator_type=prof.creator_type, bio=prof.bio, date_of_birth=prof.date_of_birth,
        gender=prof.gender, ethnicity=prof.ethnicity, education=prof.education, primary_language=prof.primary_language,
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
    _c, missing = svc.recompute_completion(db, current.id)
    # apply-readiness (the join gate) — full profile across all 5 sections.
    ready = svc.profile_completeness(db, current.id)
    return CompletionOut(
        completed=ready["complete"], missing=missing,
        sections=ready["sections"], next_section=ready["next_section"],
    )


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


@router.post("/socials/verify/start", response_model=SocialVerifyStartOut)
def start_social_verify(body: SocialVerifyIn, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    """Issue a bio-code for the creator to paste into their platform bio."""
    return verify_svc.start_verification(db, current.id, body.platform, body.handle)


@router.post("/socials/verify/confirm", response_model=SocialOut)
def confirm_social_verify(body: SocialVerifyIn, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    """Scrape the bio and, if the code is present, mark the handle verified."""
    return _social_out(verify_svc.confirm_verification(db, current.id, body.platform, body.handle))


# ---- portfolio ----
def _portfolio_out(db: Session, p) -> PortfolioOut:
    # Uploaded videos resolve their playable URL from the storage object (R2);
    # legacy items keep their external link.
    video_url = p.video_url
    is_upload = p.storage_object_id is not None
    if is_upload:
        obj = db.get(StorageObject, p.storage_object_id)
        video_url = storage.object_public_url(obj.object_key) if obj else None
    return PortfolioOut(id=str(p.id), video_url=video_url, is_upload=is_upload,
                        thumbnail_url=p.thumbnail_url, brand_name=p.brand_name,
                        caption=p.caption, platform=p.platform)


@router.get("/portfolio", response_model=list[PortfolioOut])
def list_portfolio(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    return [_portfolio_out(db, p) for p in svc.list_portfolio(db, current.id)]


@router.post("/portfolio", response_model=PortfolioOut)
def add_portfolio(body: PortfolioIn, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    return _portfolio_out(db, svc.add_portfolio(db, current.id, body.model_dump()))


@router.delete("/portfolio/{item_id}", status_code=204)
def delete_portfolio(item_id: uuid.UUID, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    svc.delete_portfolio(db, current.id, item_id)


# ---- experiences ----
def _experience_out(e) -> ExperienceOut:
    return ExperienceOut(
        id=str(e.id), kind=e.kind, kind_label=svc.EXPERIENCE_KINDS.get(e.kind, e.kind),
        title=e.title, org=e.org, url=e.url, verified=e.verified, created_at=e.created_at,
    )


@router.get("/experiences", response_model=list[ExperienceOut])
def list_experiences(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    return [_experience_out(e) for e in svc.list_experiences(db, current.id)]


@router.get("/experiences/role-titles", response_model=list[str])
def experience_role_titles():
    """The fixed job-title list the add-experience popup offers."""
    return svc.ROLE_TITLES


@router.post("/experiences", response_model=ExperienceOut)
def add_experience(body: ExperienceIn, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    return _experience_out(svc.add_experience(db, current.id, body.model_dump()))


@router.delete("/experiences/{item_id}", status_code=204)
def delete_experience(item_id: uuid.UUID, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    svc.delete_experience(db, current.id, item_id)
