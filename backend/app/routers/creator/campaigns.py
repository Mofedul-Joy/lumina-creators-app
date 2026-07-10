"""Creator-facing campaign browse + detail + join. Active campaigns only."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_creator
from app.db.session import get_db
from app.models import Campaign, Creator
from app.schemas.campaign import BonusMilestoneOut, CampaignPublicOut, MyCampaignOut, ParticipationOut
from app.services import campaign as svc

router = APIRouter(prefix="/campaigns", tags=["creator-campaigns"])


@router.get("/mine", response_model=list[MyCampaignOut])
def mine(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    """Campaigns the creator applied to / joined, with their application status."""
    return [MyCampaignOut(**m) for m in svc.list_creator_campaigns(db, current.id)]


def _public_out(c: Campaign, joined: bool, db: Session | None = None) -> CampaignPublicOut:
    milestones: list[BonusMilestoneOut] = []
    if db is not None:
        milestones = [
            BonusMilestoneOut(
                id=str(m.id), views_threshold=m.views_threshold, bonus_amount=m.bonus_amount,
                description=m.description, sort_order=m.sort_order,
            )
            for m in svc.get_bonus_milestones(db, c.id)
        ]
    return CampaignPublicOut(
        id=str(c.id), slug=c.slug, name=c.name, description=c.description, mode=c.mode,
        cpm_rate=c.cpm_rate, budget=c.budget, platforms=list(c.platforms or []),
        min_retention_days=c.min_retention_days, brief_script=c.brief_script,
        content_drive_url=c.content_drive_url, caption_rules=c.caption_rules,
        required_mentions=list(c.required_mentions or []), example_captions=list(c.example_captions or []),
        requirements_url=c.requirements_url, brand_name=c.brand_name, brand_logo_url=c.brand_logo_url,
        starts_at=c.starts_at, ends_at=c.ends_at, joined=joined,
        payment_type=c.payment_type, fixed_amount=c.fixed_amount,
        weekly_hours_needed=c.weekly_hours_needed, hourly_rate=c.hourly_rate,
        required_hours=c.required_hours, per_post_amount=c.per_post_amount,
        example_videos=list(c.example_videos or []), age_requirement=c.age_requirement,
        platform_focus=list(c.platform_focus or []), content_type=c.content_type,
        posting_frequency=c.posting_frequency, video_length=c.video_length,
        account_type=c.account_type, is_app=c.is_app, physical_product=c.physical_product,
        banner_url=c.banner_url, bonus_milestones=milestones,
        job_type=c.job_type, creator_type=c.creator_type,
    )


@router.get("", response_model=list[CampaignPublicOut])
def browse(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    campaigns = svc.list_active_campaigns(db)
    return [_public_out(c, svc.creator_has_joined(db, c.id, current.id), db) for c in campaigns]


@router.get("/{slug}", response_model=CampaignPublicOut)
def detail(slug: str, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    c = svc.get_active_campaign(db, slug)
    return _public_out(c, svc.creator_has_joined(db, c.id, current.id), db)


@router.post("/{slug}/join", response_model=ParticipationOut)
def join(slug: str, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    part = svc.join_campaign(db, current.id, slug)
    return ParticipationOut(id=str(part.id), campaign_id=str(part.campaign_id), status=part.status)
