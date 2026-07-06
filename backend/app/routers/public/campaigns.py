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
from app.schemas.campaign import CampaignPublicOut
from app.services import campaign as campaign_svc
from app.services import public_submit as svc

router = APIRouter(prefix="/public/campaigns", tags=["public-campaigns"])


def _out(c) -> CampaignPublicOut:
    return CampaignPublicOut(
        id=str(c.id), slug=c.slug, name=c.name, description=c.description, mode=c.mode,
        cpm_rate=c.cpm_rate, budget=c.budget, platforms=list(c.platforms or []),
        min_retention_days=c.min_retention_days, brief_script=c.brief_script,
        content_drive_url=c.content_drive_url, caption_rules=c.caption_rules,
        required_mentions=list(c.required_mentions or []), example_captions=list(c.example_captions or []),
        requirements_url=c.requirements_url, brand_name=c.brand_name, brand_logo_url=c.brand_logo_url,
        starts_at=c.starts_at, ends_at=c.ends_at, joined=False,
    )


@router.get("", response_model=list[CampaignPublicOut])
def browse(status: str = "active", db: Session = Depends(get_db)):
    campaigns = (
        campaign_svc.list_completed_campaigns(db)
        if status == "completed"
        else campaign_svc.list_active_campaigns(db)
    )
    return [_out(c) for c in campaigns]


@router.get("/{slug}", response_model=CampaignPublicOut)
def detail(slug: str, db: Session = Depends(get_db)):
    return _out(campaign_svc.get_active_campaign(db, slug))


class PublicSubmitIn(BaseModel):
    email: str
    post_url: str


@router.post("/{slug}/submit")
def submit(slug: str, body: PublicSubmitIn, db: Session = Depends(get_db)):
    svc.submit_public(db, slug, body.email, body.post_url)
    return {"status": "ok"}
