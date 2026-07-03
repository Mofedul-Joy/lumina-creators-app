"""Admin creator database: filterable list + drill-down profile. Admin-only."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models import Admin
from app.schemas.admin_creators import CreatorDetail, CreatorListItem
from app.services import admin_creators as svc

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
