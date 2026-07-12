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
from decimal import Decimal
from typing import List

from pydantic import BaseModel

from app.services import admin_creators as svc
from app.services import audit
from app.services import creator_activity as activity_svc
from app.services import creator_removal as removal_svc
from app.services import creators_export
from app.services import gamification as gam_svc
from app.services.csv_export import csv_response

router = APIRouter(prefix="/creators", tags=["admin-creators"])


@router.post("/thumbnails/rehost")
def rehost_thumbnails(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Re-resolve + re-host any portfolio thumbnail that isn't on our own storage
    (fixes stale Instagram CDN links that render broken). Runs in prod → R2."""
    from app.services import thumbnails
    return thumbnails.repair_portfolio_thumbnails(db)


@router.get("/export.csv")
def export_creators_csv(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Full creator database as CSV — every creator, not just the loaded page."""
    header, rows = creators_export.export_rows(db)
    return csv_response("creators_export.csv", header, rows)


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


class WeeklyPostPoint(BaseModel):
    day: str          # Mon..Sun
    date: str
    this_week: int
    last_week: int


class ViewsPoint(BaseModel):
    date: str
    views: int


class CreatorActivityOut(BaseModel):
    weekly_posts: List[WeeklyPostPoint]
    views_growth: List[ViewsPoint]
    total_posts: int
    total_views: int
    total_earned: Decimal
    total_paid: Decimal
    total_owed: Decimal
    avg_cpm: Decimal


@router.get("/{creator_id}/activity", response_model=CreatorActivityOut)
def creator_activity(
    creator_id: uuid.UUID,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Charts + headline numbers for the creator profile (weekly posts, views growth)."""
    return activity_svc.activity(db, creator_id)


class RemoveCreatorIn(BaseModel):
    mode: str    # delete_all | keep_analytics | keep_posts
    scope: str   # campaigns_only | entire


class RemoveCreatorOut(BaseModel):
    removed: bool
    mode: str
    scope: str
    email: str
    campaigns_detached: int
    hard_deleted: bool      # the row was really deleted (never been paid)
    retained_ledger: bool   # scrubbed + tombstoned instead, to keep payouts intact


@router.post("/{creator_id}/remove", response_model=RemoveCreatorOut)
def remove_creator(
    creator_id: uuid.UUID,
    body: RemoveCreatorIn,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Remove a creator. See services/creator_removal for what each mode does."""
    result = removal_svc.remove_creator(db, creator_id, body.mode, body.scope)
    # The service already committed (it may have hard-deleted the row), so the
    # audit row needs its own commit — audit.log only flushes.
    audit.log(
        db,
        actor_admin_id=admin.id,
        action="creator.remove",
        entity_type="creator",
        entity_id=None if result["hard_deleted"] else creator_id,
        mode=body.mode,
        scope=body.scope,
        email=result["email"],
        hard_deleted=result["hard_deleted"],
        retained_ledger=result["retained_ledger"],
    )
    db.commit()
    return result


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
