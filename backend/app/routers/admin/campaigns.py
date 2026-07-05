"""Admin campaign builder: CRUD + publish + archive (soft-delete)."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.core.security import create_impersonation_token
from app.db.session import get_db
from app.models import Admin, Campaign, CreatorProfile, Submission
from app.schemas.campaign import CampaignCreateIn, CampaignOut, CampaignUpdateIn
from app.services import audit, campaign as svc
from app.services.csv_export import csv_response

router = APIRouter(prefix="/campaigns", tags=["admin-campaigns"])


def campaign_out(c: Campaign) -> CampaignOut:
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
    )


@router.post("", response_model=CampaignOut)
def create(body: CampaignCreateIn, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return campaign_out(svc.create_campaign(db, admin.id, body.model_dump()))


@router.get("", response_model=list[CampaignOut])
def list_all(status: Optional[str] = None, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return [campaign_out(c) for c in svc.list_campaigns(db, status)]


@router.get("/{campaign_id}", response_model=CampaignOut)
def get_one(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return campaign_out(svc.get_campaign(db, campaign_id))


@router.patch("/{campaign_id}", response_model=CampaignOut)
def update(campaign_id: uuid.UUID, body: CampaignUpdateIn, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return campaign_out(svc.update_campaign(db, campaign_id, body.model_dump(exclude_unset=True)))


@router.post("/{campaign_id}/publish", response_model=CampaignOut)
def publish(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return campaign_out(svc.publish_campaign(db, campaign_id, admin.id))


@router.post("/{campaign_id}/close", response_model=CampaignOut)
def close(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return campaign_out(svc.close_campaign(db, campaign_id, admin.id))


@router.post("/{campaign_id}/reopen", response_model=CampaignOut)
def reopen(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return campaign_out(svc.reopen_campaign(db, campaign_id, admin.id))


@router.post("/{campaign_id}/archive", response_model=CampaignOut)
def archive(campaign_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return campaign_out(svc.archive_campaign(db, campaign_id, admin.id))


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
