"""Creator self-service aggregate endpoints that don't fit under /profile,
/campaigns, or /submissions. Currently just gamification (Feature 7,
BUILD_SPEC.md 3.9): rank/xp/streak/awards for the creator's own dashboard."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_creator
from app.db.session import get_db
from app.models import Creator
from app.schemas.admin_creators import CreatorRichDetail
from app.schemas.gamification import CreatorGamificationOut
from app.services import gamification as svc
from app.services.admin_creators import get_creator_rich_detail

router = APIRouter(prefix="/me", tags=["creator-me"])


@router.get("/gamification", response_model=CreatorGamificationOut)
def my_gamification(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    """The creator's own rank/xp/streak/awards — completes the gamification
    loop that Feature 2 started on the admin side (rich detail card)."""
    return CreatorGamificationOut(**svc.get_creator_gamification(db, current.id))


@router.get(
    "/portfolio",
    response_model=CreatorRichDetail,
    response_model_exclude={"is_suspicious"},  # internal fraud flag — never show the creator
)
def my_portfolio(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    """The creator's own portfolio page data — reuses the same rich-detail
    payload the admin sees (stats, top content, brands/experiences, socials)."""
    return CreatorRichDetail(**get_creator_rich_detail(db, current.id))
