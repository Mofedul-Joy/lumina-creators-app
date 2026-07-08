"""Admin creator database: filterable list + drill-down profile. Admin-only."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models import Admin
from app.schemas.admin_creators import CreatorDetail, CreatorListItem, CreatorRichDetail
from app.schemas.gamification import CreatorGamificationOut
from app.services import admin_creators as svc
from app.services import gamification as gam_svc

router = APIRouter(prefix="/creators", tags=["admin-creators"])


@router.get("", response_model=list[CreatorListItem])
def list_creators(
    q: Optional[str] = None,
    gender: Optional[str] = None,
    ethnicity: Optional[str] = None,
    primary_language: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    age_min: Optional[int] = None,
    age_max: Optional[int] = None,
    platform: Optional[str] = None,
    min_followers: Optional[int] = None,
    social: Optional[str] = None,
    completed_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    rows = svc.list_creators(
        db, q=q, gender=gender, ethnicity=ethnicity, primary_language=primary_language,
        country=country, city=city, age_min=age_min, age_max=age_max, platform=platform,
        min_followers=min_followers, social=social, completed_only=completed_only, limit=limit, offset=offset,
    )
    return [CreatorListItem(**r) for r in rows]


@router.get("/{creator_id}", response_model=CreatorDetail)
def creator_detail(creator_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return CreatorDetail(**svc.get_creator_detail(db, creator_id))


@router.get("/{creator_id}/rich", response_model=CreatorRichDetail)
def creator_rich_detail(creator_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    """SideShift-style rich detail card (Feature 2) — superset of `creator_detail`
    with gamification (rank/xp/streak/awards), niches, experiences, and a
    recent-submissions video reel. Keeps the plain endpoint above intact."""
    return CreatorRichDetail(**svc.get_creator_rich_detail(db, creator_id))


@router.post("/{creator_id}/flag-suspicious", response_model=CreatorDetail)
def flag_suspicious(creator_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    svc.set_suspicious(db, creator_id, True, admin.id)
    return CreatorDetail(**svc.get_creator_detail(db, creator_id))


@router.post("/{creator_id}/unflag-suspicious", response_model=CreatorDetail)
def unflag_suspicious(creator_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    svc.set_suspicious(db, creator_id, False, admin.id)
    return CreatorDetail(**svc.get_creator_detail(db, creator_id))


@router.post("/{creator_id}/refresh-gamification", response_model=CreatorGamificationOut)
def refresh_gamification(creator_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Admin-triggered write-back (Feature 7): recompute rank/xp/awards for one
    creator and persist to `creator_profiles`, then return the fresh snapshot."""
    gam_svc.refresh_creator_gamification(db, creator_id)
    return CreatorGamificationOut(**gam_svc.get_creator_gamification(db, creator_id))


@router.post("/refresh-gamification-all")
def refresh_gamification_all(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Admin-triggered bulk write-back (Feature 7): recompute rank/xp/awards
    for every creator with a profile."""
    count = gam_svc.refresh_all_gamification(db)
    return {"updated": count}
