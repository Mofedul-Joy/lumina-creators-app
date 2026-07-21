"""Client (brand) read-only dashboard: their campaigns with aggregated
performance, plus per-campaign submission rows. Strictly scoped to
campaigns.client_id == current client; never exposes creator PII beyond
display-safe fields, and never mutates."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_client
from app.db.session import get_db
from app.models import Campaign, Client, Submission
from app.services.csv_export import csv_response

router = APIRouter(prefix="/campaigns", tags=["client-campaigns"])


class ClientCampaignOut(BaseModel):
    id: str
    slug: str
    name: str
    description: Optional[str] = None
    mode: str
    status: str
    cpm_rate: Decimal
    budget: Decimal
    spent_amount: Decimal
    payment_type: Optional[str] = None
    fixed_amount: Optional[Decimal] = None
    platforms: List[str] = []
    brand_name: Optional[str] = None
    published_at: Optional[datetime] = None
    # aggregated performance
    total_views: int = 0
    total_likes: int = 0
    total_comments: int = 0
    submission_count: int = 0
    creator_count: int = 0


class ClientSubmissionOut(BaseModel):
    id: str
    post_url: str
    platform: str
    views: int
    likes: int
    comments: int
    thumbnail_url: Optional[str] = None
    post_unavailable: bool = False
    submitted_at: datetime


def _stats(db: Session, campaign_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict]:
    if not campaign_ids:
        return {}
    rows = db.execute(
        select(
            Submission.campaign_id,
            func.coalesce(func.sum(Submission.views), 0),
            func.coalesce(func.sum(Submission.likes), 0),
            func.coalesce(func.sum(Submission.comments), 0),
            func.count(Submission.id),
            func.count(func.distinct(Submission.creator_id)),
        )
        .where(
            Submission.campaign_id.in_(campaign_ids),
            Submission.verification_status == "verified",
        )
        .group_by(Submission.campaign_id)
    ).all()
    return {
        r[0]: {
            "total_views": r[1], "total_likes": r[2], "total_comments": r[3],
            "submission_count": r[4], "creator_count": r[5],
        }
        for r in rows
    }


def _campaign_out(c: Campaign, stats: dict) -> ClientCampaignOut:
    return ClientCampaignOut(
        id=str(c.id), slug=c.slug, name=c.name, description=c.description, mode=c.mode,
        status=c.status, cpm_rate=c.cpm_rate, budget=c.budget, spent_amount=c.spent_amount,
        payment_type=c.payment_type, fixed_amount=c.fixed_amount,
        platforms=list(c.platforms or []), brand_name=c.brand_name, published_at=c.published_at,
        **stats.get(c.id, {}),
    )


@router.get("", response_model=list[ClientCampaignOut])
def list_mine(current: Client = Depends(get_current_client), db: Session = Depends(get_db)):
    campaigns = db.scalars(
        select(Campaign).where(Campaign.client_id == current.id).order_by(Campaign.created_at.desc())
    ).all()
    stats = _stats(db, [c.id for c in campaigns])
    return [_campaign_out(c, stats) for c in campaigns]


@router.get("/{campaign_id}/submissions", response_model=list[ClientSubmissionOut])
def campaign_submissions(
    campaign_id: uuid.UUID,
    current: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None or campaign.client_id != current.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    subs = db.scalars(
        select(Submission)
        .where(Submission.campaign_id == campaign_id, Submission.is_suspicious.is_(False))
        .order_by(Submission.created_at.desc())
        .limit(200)
    ).all()
    return [
        ClientSubmissionOut(
            id=str(s.id), post_url=s.post_url, platform=s.platform,
            views=s.views, likes=s.likes, comments=s.comments,
            thumbnail_url=s.thumbnail_url, post_unavailable=s.post_unavailable,
            submitted_at=s.created_at,
        )
        for s in subs
    ]


@router.get("/{campaign_id}/export")
def export_submissions_csv(
    campaign_id: uuid.UUID,
    current: Client = Depends(get_current_client),
    db: Session = Depends(get_db),
):
    """Same PII-free field set as the dashboard's submission table — no
    creator identity, no internal IDs, no admin-only fields — just streamed
    without the 200-row cap the dashboard view applies."""
    campaign = db.get(Campaign, campaign_id)
    if campaign is None or campaign.client_id != current.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    subs = db.scalars(
        select(Submission)
        .where(Submission.campaign_id == campaign_id, Submission.is_suspicious.is_(False))
        .order_by(Submission.created_at.asc())
    ).all()

    def rows_iter():
        for s in subs:
            yield [s.platform, s.post_url, s.views, s.likes, s.comments, s.created_at.isoformat()]

    header = ["Platform", "Post URL", "Views", "Likes", "Comments", "Submitted At"]
    return csv_response(f"{campaign.slug}_submissions.csv", header, rows_iter())
