"""Admin: list client (brand) accounts + per-client submission rollups, and
mint a short-lived "view as client" impersonation token. Powers the campaign
builder's client picker AND the admin dashboard's per-client submissions panel.
Creation stays manual/seeded for now."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.core.security import create_impersonation_token
from app.db.session import get_db
from app.models import Admin, Campaign, Client, CreatorProfile, Submission
from app.services import audit

router = APIRouter(prefix="/clients", tags=["admin-clients"])


class ClientListItem(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    status: str
    campaign_count: int = 0
    submission_count: int = 0
    total_views: int = 0
    total_interactions: int = 0


class ClientCampaignSubmission(BaseModel):
    id: str
    creator_id: str
    creator_name: Optional[str] = None
    platform: str
    post_url: str
    views: int
    likes: int
    comments: int
    estimated_amount: Decimal
    verification_status: str
    scrape_status: str
    thumbnail_url: Optional[str] = None
    created_at: datetime


class ClientCampaignItem(BaseModel):
    id: str
    name: str
    slug: str
    status: str
    platforms: list[str] = []
    cpm_rate: Decimal
    budget: Decimal
    submissions: list[ClientCampaignSubmission] = []


def _client_rollups(db: Session) -> dict[uuid.UUID, dict]:
    """Per-client aggregate across all of a client's campaigns' submissions."""
    rows = db.execute(
        select(
            Campaign.client_id,
            func.count(func.distinct(Campaign.id)),
            func.count(Submission.id),
            func.coalesce(func.sum(Submission.views), 0),
            func.coalesce(func.sum(Submission.likes + Submission.comments), 0),
        )
        .select_from(Campaign)
        .outerjoin(
            Submission,
            and_(
                Submission.campaign_id == Campaign.id,
                Submission.verification_status == "verified",
            ),
        )
        .where(Campaign.client_id.isnot(None))
        .group_by(Campaign.client_id)
    ).all()
    return {
        r[0]: {
            "campaign_count": r[1] or 0,
            "submission_count": r[2] or 0,
            "total_views": int(r[3] or 0),
            "total_interactions": int(r[4] or 0),
        }
        for r in rows
    }


@router.get("", response_model=list[ClientListItem])
def list_clients(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    rows = db.scalars(select(Client).order_by(Client.created_at.desc())).all()
    stats = _client_rollups(db)
    return [
        ClientListItem(
            id=str(c.id), email=c.email, name=c.name, status=c.status,
            **stats.get(c.id, {}),
        )
        for c in rows
    ]


@router.get("/{client_id}/campaigns", response_model=list[ClientCampaignItem])
def client_campaigns(client_id: uuid.UUID, admin: Admin = Depends(get_current_admin),
                     db: Session = Depends(get_db)):
    """All campaigns assigned to a client, including completed/archived and
    campaigns with no submissions. Sorted alphabetically for picker/panel use."""
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client not found")
    campaigns = db.scalars(
        select(Campaign)
        .where(Campaign.client_id == client_id)
        .order_by(func.lower(Campaign.name).asc(), Campaign.created_at.desc())
    ).all()
    if not campaigns:
        return []
    campaign_ids = [c.id for c in campaigns]
    rows = db.execute(
        select(Submission, CreatorProfile.display_name)
        .outerjoin(CreatorProfile, CreatorProfile.creator_id == Submission.creator_id)
        .where(Submission.campaign_id.in_(campaign_ids))
        .order_by(Submission.created_at.desc())
    ).all()
    by_campaign: dict[uuid.UUID, list[ClientCampaignSubmission]] = {c.id: [] for c in campaigns}
    for sub, display_name in rows:
        by_campaign[sub.campaign_id].append(ClientCampaignSubmission(
            id=str(sub.id), creator_id=str(sub.creator_id), creator_name=display_name,
            platform=sub.platform, post_url=sub.post_url, views=sub.views,
            likes=sub.likes, comments=sub.comments, estimated_amount=sub.estimated_amount,
            verification_status=sub.verification_status, scrape_status=sub.scrape_status,
            thumbnail_url=sub.thumbnail_url, created_at=sub.created_at,
        ))
    return [
        ClientCampaignItem(
            id=str(c.id), name=c.name, slug=c.slug, status=c.status,
            platforms=list(c.platforms or []), cpm_rate=c.cpm_rate, budget=c.budget,
            submissions=by_campaign[c.id],
        )
        for c in campaigns
    ]


@router.post("/{client_id}/impersonate")
def impersonate(client_id: uuid.UUID, admin: Admin = Depends(get_current_admin),
                db: Session = Depends(get_db)):
    """Mint a 15-minute client-scoped token so an admin can open the brand's own
    dashboard exactly as that client sees it ("View as client"). Audit-logged
    since it's a real (if short-lived) session as someone else's account."""
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client not found")
    token = create_impersonation_token(str(client_id), str(admin.id))
    audit.log(db, actor_admin_id=admin.id, action="client.impersonate",
              entity_type="client", entity_id=client_id)
    db.commit()
    return {"access_token": token}
