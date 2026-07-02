"""Admin analytics — network-wide performance for the owner's overview.

All derived from existing submission/campaign data; no new tables. Views are
cumulative on each submission (updated by scraping), so the daily series is keyed
on submission created_at (activity), while views/spend are lifetime aggregates.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import Date, cast, func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.core.security import _now
from app.db.session import get_db
from app.models import Admin, Campaign, CreatorProfile, Submission

router = APIRouter(prefix="/analytics", tags=["admin-analytics"])

WINDOW_DAYS = 30


class Kpis(BaseModel):
    total_views: int
    total_spend: Decimal
    total_submissions: int
    verified_submissions: int
    active_campaigns: int
    active_creators: int  # distinct creators who have submitted
    avg_cpm: Decimal      # effective $ per 1000 views
    engagement_rate: Decimal  # (likes + comments) / views, %


class PlatformStat(BaseModel):
    platform: str
    views: int
    submissions: int


class DayPoint(BaseModel):
    date: str            # YYYY-MM-DD
    submissions: int
    views: int
    spend: Decimal


class TopCampaign(BaseModel):
    id: str
    name: str
    views: int
    submissions: int
    spend: Decimal


class TopCreator(BaseModel):
    id: str
    display_name: str
    views: int
    submissions: int


class AdminAnalytics(BaseModel):
    kpis: Kpis
    by_platform: list[PlatformStat]
    daily: list[DayPoint]
    top_campaigns: list[TopCampaign]
    top_creators: list[TopCreator]


@router.get("", response_model=AdminAnalytics)
def analytics(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    scalar = lambda stmt: db.execute(stmt).scalar()  # noqa: E731
    i = lambda v: int(v or 0)                          # noqa: E731
    d = lambda v: Decimal(v or 0)                      # noqa: E731

    total_views = i(scalar(select(func.sum(Submission.views))))
    total_spend = d(scalar(select(func.sum(Submission.estimated_amount))))
    total_subs = i(scalar(select(func.count()).select_from(Submission)))
    verified = i(scalar(
        select(func.count()).select_from(Submission).where(Submission.verification_status == "verified")
    ))
    active_campaigns = i(scalar(
        select(func.count()).select_from(Campaign).where(Campaign.status == "active")
    ))
    active_creators = i(scalar(select(func.count(func.distinct(Submission.creator_id)))))
    total_likes = i(scalar(select(func.sum(Submission.likes))))
    total_comments = i(scalar(select(func.sum(Submission.comments))))

    avg_cpm = (total_spend / total_views * 1000) if total_views else Decimal(0)
    engagement = (Decimal(total_likes + total_comments) / total_views * 100) if total_views else Decimal(0)

    # platform breakdown
    by_platform = [
        PlatformStat(platform=row.platform, views=i(row.v), submissions=i(row.c))
        for row in db.execute(
            select(
                Submission.platform,
                func.sum(Submission.views).label("v"),
                func.count().label("c"),
            ).group_by(Submission.platform).order_by(func.sum(Submission.views).desc())
        )
    ]

    # daily activity for the last WINDOW_DAYS, zero-filled
    since = _now() - timedelta(days=WINDOW_DAYS - 1)
    day = cast(Submission.created_at, Date).label("day")
    rows = db.execute(
        select(
            day,
            func.count().label("subs"),
            func.sum(Submission.views).label("views"),
            func.sum(Submission.estimated_amount).label("spend"),
        ).where(Submission.created_at >= since).group_by(day)
    ).all()
    by_day = {r.day: r for r in rows}
    start = since.date()
    daily = []
    for n in range(WINDOW_DAYS):
        dd = start + timedelta(days=n)
        r = by_day.get(dd)
        daily.append(DayPoint(
            date=dd.isoformat(),
            submissions=i(r.subs) if r else 0,
            views=i(r.views) if r else 0,
            spend=d(r.spend) if r else Decimal(0),
        ))

    # top campaigns by views
    top_campaigns = [
        TopCampaign(id=str(row.id), name=row.name, views=i(row.v),
                    submissions=i(row.c), spend=d(row.s))
        for row in db.execute(
            select(
                Campaign.id, Campaign.name,
                func.coalesce(func.sum(Submission.views), 0).label("v"),
                func.count(Submission.id).label("c"),
                func.coalesce(func.sum(Submission.estimated_amount), 0).label("s"),
            )
            .join(Submission, Submission.campaign_id == Campaign.id)
            .group_by(Campaign.id, Campaign.name)
            .order_by(func.sum(Submission.views).desc())
            .limit(6)
        )
    ]

    # top creators by views
    top_creators = [
        TopCreator(id=str(row.creator_id), display_name=row.display_name or "Unnamed",
                   views=i(row.v), submissions=i(row.c))
        for row in db.execute(
            select(
                Submission.creator_id,
                CreatorProfile.display_name,
                func.coalesce(func.sum(Submission.views), 0).label("v"),
                func.count(Submission.id).label("c"),
            )
            .join(CreatorProfile, CreatorProfile.creator_id == Submission.creator_id)
            .group_by(Submission.creator_id, CreatorProfile.display_name)
            .order_by(func.sum(Submission.views).desc())
            .limit(6)
        )
    ]

    return AdminAnalytics(
        kpis=Kpis(
            total_views=total_views, total_spend=total_spend, total_submissions=total_subs,
            verified_submissions=verified, active_campaigns=active_campaigns,
            active_creators=active_creators, avg_cpm=avg_cpm.quantize(Decimal("0.01")),
            engagement_rate=engagement.quantize(Decimal("0.01")),
        ),
        by_platform=by_platform,
        daily=daily,
        top_campaigns=top_campaigns,
        top_creators=top_creators,
    )
