"""Admin dashboard aggregate stats — one cheap query set for the ops overview."""
from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models import Admin, Campaign, Client, Creator, Submission

router = APIRouter(prefix="/stats", tags=["admin-stats"])


class RecentCampaign(BaseModel):
    id: str
    name: str
    status: str
    mode: str
    cpm_rate: Decimal
    budget: Decimal


class AdminStats(BaseModel):
    total_campaigns: int
    active_campaigns: int
    total_creators: int
    completed_creators: int
    total_submissions: int
    total_views: int
    total_clients: int
    total_budget: Decimal
    recent_campaigns: list[RecentCampaign]


@router.get("", response_model=AdminStats)
def stats(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    scalar = lambda stmt: db.execute(stmt).scalar() or 0  # noqa: E731

    total_campaigns = scalar(select(func.count()).select_from(Campaign))
    active_campaigns = scalar(select(func.count()).select_from(Campaign).where(Campaign.status == "active"))
    total_creators = scalar(select(func.count()).select_from(Creator))
    completed_creators = scalar(
        select(func.count()).select_from(Creator).where(Creator.status == "active")
    )
    total_submissions = scalar(select(func.count()).select_from(Submission))
    total_views = scalar(select(func.coalesce(func.sum(Submission.views), 0)))
    total_clients = scalar(select(func.count()).select_from(Client))
    total_budget = db.execute(select(func.coalesce(func.sum(Campaign.budget), 0))).scalar() or Decimal(0)

    recent = db.scalars(select(Campaign).order_by(Campaign.created_at.desc()).limit(5)).all()

    return AdminStats(
        total_campaigns=total_campaigns,
        active_campaigns=active_campaigns,
        total_creators=total_creators,
        completed_creators=completed_creators,
        total_submissions=total_submissions,
        total_views=total_views,
        total_clients=total_clients,
        total_budget=total_budget,
        recent_campaigns=[
            RecentCampaign(id=str(c.id), name=c.name, status=c.status, mode=c.mode,
                           cpm_rate=c.cpm_rate, budget=c.budget)
            for c in recent
        ],
    )
