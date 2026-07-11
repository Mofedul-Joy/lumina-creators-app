"""Admin campaign builder: CRUD + publish + archive (soft-delete)."""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_admin
from app.core.security import create_impersonation_token
from app.db.session import get_db
from app.models import Admin, Campaign, CampaignBonusMilestone, CreatorProfile, Submission
from app.schemas.campaign import BonusMilestoneOut, CampaignCreateIn, CampaignOut, CampaignUpdateIn, ShareTokenOut
from app.services import audit, campaign as svc
from app.services import campaign_overview as overview_svc
from app.services.csv_export import csv_response

router = APIRouter(prefix="/campaigns", tags=["admin-campaigns"])


def campaign_out(c: Campaign, db: Session | None = None) -> CampaignOut:
    milestones: list[BonusMilestoneOut] = []
    if db is not None:
        rows = db.scalars(
            select(CampaignBonusMilestone)
            .where(CampaignBonusMilestone.campaign_id == c.id)
            .order_by(CampaignBonusMilestone.sort_order.asc())
        ).all()
        milestones = [
            BonusMilestoneOut(
                id=str(m.id), views_threshold=m.views_threshold, bonus_amount=m.bonus_amount,
                description=m.description, sort_order=m.sort_order,
            )
            for m in rows
        ]
    return CampaignOut(
        id=str(c.id), slug=c.slug, name=c.name, description=c.description, mode=c.mode,
        status=c.status, cpm_rate=c.cpm_rate, budget=c.budget, spent_amount=c.spent_amount,
        max_payout_per_creator=c.max_payout_per_creator, eligible_view_pct=c.eligible_view_pct,
        min_retention_days=c.min_retention_days, platforms=list(c.platforms or []),
        geo_countries=list(c.geo_countries or []), brief_script=c.brief_script,
        content_drive_url=c.content_drive_url, caption_rules=c.caption_rules,
        required_mentions=list(c.required_mentions or []), example_captions=list(c.example_captions or []),
        requirements_url=c.requirements_url, brand_name=c.brand_name, brand_logo_url=c.brand_logo_url,
        client_id=str(c.client_id) if c.client_id else None,
        starts_at=c.starts_at, ends_at=c.ends_at, published_at=c.published_at,
        job_type=c.job_type, creator_type=c.creator_type, payment_type=c.payment_type,
        fixed_amount=c.fixed_amount, weekly_hours_needed=c.weekly_hours_needed,
        hourly_rate=c.hourly_rate, required_hours=c.required_hours, per_post_amount=c.per_post_amount,
        example_videos=list(c.example_videos or []), age_requirement=c.age_requirement,
        platform_focus=list(c.platform_focus or []), content_type=c.content_type,
        posting_frequency=c.posting_frequency, video_length=c.video_length, account_type=c.account_type,
        is_app=c.is_app, physical_product=c.physical_product, banner_url=c.banner_url,
        bonus_milestones=milestones,
        # ---- campaign creation flow (0024) ----
        campaign_kind=c.campaign_kind, experience_level=c.experience_level,
        no_platform_tracking=c.no_platform_tracking, payment_schedule=c.payment_schedule,
        payment_cycle_trigger=c.payment_cycle_trigger, pro_rata=c.pro_rata,
        min_views=c.min_views, posts_per_payment=c.posts_per_payment,
        share_token=c.share_token, share_enabled=c.share_enabled,
    )


@router.post("", response_model=CampaignOut)
def create(body: CampaignCreateIn, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return campaign_out(svc.create_campaign(db, admin.id, body.model_dump()), db)


@router.get("", response_model=list[CampaignOut])
def list_all(status: Optional[str] = None, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return [campaign_out(c, db) for c in svc.list_campaigns(db, status)]


@router.get("/{campaign_id}", response_model=CampaignOut)
def get_one(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return campaign_out(svc.get_campaign(db, campaign_id), db)


@router.patch("/{campaign_id}", response_model=CampaignOut)
def update(campaign_id: uuid.UUID, body: CampaignUpdateIn, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return campaign_out(svc.update_campaign(db, campaign_id, body.model_dump(exclude_unset=True)), db)


@router.post("/{campaign_id}/publish", response_model=CampaignOut)
def publish(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return campaign_out(svc.publish_campaign(db, campaign_id, admin.id), db)


@router.post("/{campaign_id}/close", response_model=CampaignOut)
def close(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return campaign_out(svc.close_campaign(db, campaign_id, admin.id), db)


@router.post("/{campaign_id}/reopen", response_model=CampaignOut)
def reopen(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return campaign_out(svc.reopen_campaign(db, campaign_id, admin.id), db)


@router.post("/{campaign_id}/archive", response_model=CampaignOut)
def archive(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return campaign_out(svc.archive_campaign(db, campaign_id, admin.id), db)


class CampaignOverviewCreator(BaseModel):
    creator_id: str
    display_name: str
    avatar_url: Optional[str] = None
    status: str
    posts: int
    views: int
    earned: Decimal
    joined_at: datetime


class CampaignOverviewOut(BaseModel):
    active_creators: int
    delivered_creators: int
    total_posts: int
    total_views: int
    total_spend: Decimal
    creators: List[CampaignOverviewCreator]


@router.get("/{campaign_id}/overview", response_model=CampaignOverviewOut)
def campaign_overview(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Stat tiles + active-creator list for the campaign detail page."""
    svc.get_campaign(db, campaign_id)  # 404 if it doesn't exist
    return overview_svc.overview(db, campaign_id)


@router.post("/{campaign_id}/convert-to-advanced", response_model=CampaignOut)
def convert_to_advanced(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    """One-way flip to the advanced setup — just exposes the extra options; it
    never removes anything the admin already configured."""
    return campaign_out(svc.update_campaign(db, campaign_id, {"experience_level": "advanced"}), db)


@router.post("/{campaign_id}/impersonate-client")
def impersonate_client(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Mints a 15-minute client-scoped token so an admin can see this campaign's
    client dashboard exactly as that client would. Audit-logged since it's a
    real (if short-lived) session as someone else's account."""
    campaign = svc.get_campaign(db, campaign_id)
    if campaign.client_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This campaign has no client account linked")
    token = create_impersonation_token(str(campaign.client_id), str(admin.id))
    audit.log(db, actor_admin_id=admin.id, action="client.impersonate", entity_type="client",
             entity_id=campaign.client_id, campaign_id=str(campaign_id))
    db.commit()
    return {"access_token": token}


@router.get("/{campaign_id}/export")
def export_submissions_csv(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Every submission in the campaign, no pagination cap — the whole point
    of a CSV export is to get data the dashboard's paged view can't show."""
    campaign = svc.get_campaign(db, campaign_id)
    rows = db.execute(
        select(Submission, CreatorProfile.display_name)
        .outerjoin(CreatorProfile, CreatorProfile.creator_id == Submission.creator_id)
        .where(Submission.campaign_id == campaign_id)
        .order_by(Submission.created_at.asc())
    ).all()

    def rows_iter():
        for sub, display_name in rows:
            yield [
                str(sub.id), display_name or "", str(sub.creator_id), sub.platform, sub.post_url,
                sub.views, sub.likes, sub.comments, str(sub.estimated_amount),
                str(sub.payable_amount) if sub.payable_amount is not None else "",
                sub.verification_status, sub.scrape_status, sub.is_suspicious,
                sub.verification_note or "", sub.created_at.isoformat(),
            ]

    header = [
        "Submission ID", "Creator Name", "Creator ID", "Platform", "Post URL",
        "Views", "Likes", "Comments", "Estimated Amount", "Payable Amount",
        "Verification Status", "Scrape Status", "Suspicious", "Note", "Created At",
    ]
    return csv_response(f"{campaign.slug}_submissions.csv", header, rows_iter())


# ── Client read-only report + share_token (Feature 6, BUILD_SPEC.md §3.7) ──
# A copyable, no-login link an admin sends a client so they can watch a
# single campaign's performance without an account. Gated by a high-entropy
# token (secrets.token_urlsafe(24) — 32 url-safe chars) rather than any
# per-client auth, so rotate/disable are the only "revoke access" levers.


def _share_url(token: str) -> str:
    return f"{get_settings().frontend_url.rstrip('/')}/report/{token}"


@router.post("/{campaign_id}/share", response_model=ShareTokenOut)
def enable_share(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Enable the public share page. Generates a token if one doesn't exist yet;
    re-enabling an already-tokened campaign just flips share_enabled back on
    (keeps the same link stable across disable/enable cycles)."""
    campaign = svc.get_campaign(db, campaign_id)
    if not campaign.share_token:
        campaign.share_token = secrets.token_urlsafe(24)
    campaign.share_enabled = True
    audit.log(db, actor_admin_id=admin.id, action="campaign.share_enable", entity_type="campaign", entity_id=campaign_id)
    db.commit()
    db.refresh(campaign)
    return ShareTokenOut(share_token=campaign.share_token, share_enabled=campaign.share_enabled, share_url=_share_url(campaign.share_token))


@router.post("/{campaign_id}/share/rotate", response_model=ShareTokenOut)
def rotate_share(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Generate a NEW token, immediately invalidating the old link."""
    campaign = svc.get_campaign(db, campaign_id)
    campaign.share_token = secrets.token_urlsafe(24)
    campaign.share_enabled = True
    audit.log(db, actor_admin_id=admin.id, action="campaign.share_rotate", entity_type="campaign", entity_id=campaign_id)
    db.commit()
    db.refresh(campaign)
    return ShareTokenOut(share_token=campaign.share_token, share_enabled=campaign.share_enabled, share_url=_share_url(campaign.share_token))


@router.post("/{campaign_id}/share/disable", response_model=ShareTokenOut)
def disable_share(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Turn off public access. Keeps the token stored (re-enable restores the
    same link) but the public GET 404s while disabled."""
    campaign = svc.get_campaign(db, campaign_id)
    campaign.share_enabled = False
    audit.log(db, actor_admin_id=admin.id, action="campaign.share_disable", entity_type="campaign", entity_id=campaign_id)
    db.commit()
    db.refresh(campaign)
    return ShareTokenOut(
        share_token=campaign.share_token or "", share_enabled=campaign.share_enabled,
        share_url=_share_url(campaign.share_token) if campaign.share_token else "",
    )
