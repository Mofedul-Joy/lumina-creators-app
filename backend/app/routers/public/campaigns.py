"""Public (unauthenticated) campaign browse + email/URL submit — the entry
point for a creator who hasn't signed up yet. Mirrors the reference app's
campaign-first funnel: pick a campaign, submit an email + post URL, then
check-email/set-password on the success step (handled by the existing
/api/creator/auth/check-email + set-password/login endpoints, unmodified)."""
from __future__ import annotations

from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.campaign import BonusMilestoneOut, CampaignPublicOut
from app.services import campaign as campaign_svc
from app.services import public_submit as svc

router = APIRouter(prefix="/public/campaigns", tags=["public-campaigns"])


def _out(c, db: Session | None = None) -> CampaignPublicOut:
    from app.schemas.campaign import ExampleVideoOut
    from app.services import campaign_examples
    milestones: list[BonusMilestoneOut] = []
    examples: list[ExampleVideoOut] = []
    if db is not None:
        milestones = [
            BonusMilestoneOut(
                id=str(m.id), views_threshold=m.views_threshold, bonus_amount=m.bonus_amount,
                description=m.description, sort_order=m.sort_order,
            )
            for m in campaign_svc.get_bonus_milestones(db, c.id)
        ]
        examples = [ExampleVideoOut(**e) for e in campaign_examples.examples_public(db, c.id)]
    return CampaignPublicOut(
        id=str(c.id), slug=c.slug, name=c.name, description=c.description, mode=c.mode,
        cpm_rate=c.cpm_rate, budget=c.budget, platforms=list(c.platforms or []),
        min_retention_days=c.min_retention_days, brief_script=c.brief_script,
        content_drive_url=c.content_drive_url, caption_rules=c.caption_rules,
        required_mentions=list(c.required_mentions or []), example_captions=list(c.example_captions or []),
        requirements_url=c.requirements_url, brand_name=c.brand_name, brand_logo_url=c.brand_logo_url,
        starts_at=c.starts_at, ends_at=c.ends_at, joined=False,
        payment_type=c.payment_type, fixed_amount=c.fixed_amount,
        weekly_hours_needed=c.weekly_hours_needed, hourly_rate=c.hourly_rate,
        required_hours=c.required_hours, per_post_amount=c.per_post_amount,
        example_videos=list(c.example_videos or []), examples=examples, age_requirement=c.age_requirement,
        platform_focus=list(c.platform_focus or []), content_type=c.content_type,
        posting_frequency=c.posting_frequency, video_length=c.video_length,
        account_type=c.account_type, is_app=c.is_app, physical_product=c.physical_product,
        banner_url=c.banner_url, bonus_milestones=milestones,
        job_type=c.job_type, creator_type=c.creator_type,
    )


@router.get("", response_model=list[CampaignPublicOut])
def browse(status: str = "active", db: Session = Depends(get_db)):
    campaigns = (
        campaign_svc.list_completed_campaigns(db)
        if status == "completed"
        else campaign_svc.list_active_campaigns(db)
    )
    return [_out(c, db) for c in campaigns]


@router.get("/{slug}", response_model=CampaignPublicOut)
def detail(slug: str, db: Session = Depends(get_db)):
    return _out(campaign_svc.get_active_campaign(db, slug), db)


class PublicSubmitIn(BaseModel):
    email: str
    post_url: str


@router.post("/{slug}/submit")
def submit(slug: str, body: PublicSubmitIn, db: Session = Depends(get_db)):
    svc.submit_public(db, slug, body.email, body.post_url)
    return {"status": "ok"}
