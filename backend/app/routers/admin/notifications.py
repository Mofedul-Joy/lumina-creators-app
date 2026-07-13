"""Admin notifications — a lightweight, derived activity feed for the bell next
to the admin messages launcher.

No table of its own: it aggregates the events an admin actually needs to act on
(videos awaiting review, brand-new applicants), newest first. 'Unread' is tracked
client-side against the newest item's timestamp, so there's no write path to keep
in sync — the feed is always a fresh read of current state.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models import Admin, Campaign, CampaignParticipation, CreatorProfile, Submission

router = APIRouter(prefix="/notifications", tags=["admin-notifications"])

LIMIT = 30


class AdminNotification(BaseModel):
    id: str
    kind: str  # video_submission | applicant
    title: str
    body: str
    link: str
    created_at: datetime


def _name(display_name) -> str:
    return display_name or "A creator"


@router.get("", response_model=list[AdminNotification])
def list_notifications(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    items: list[AdminNotification] = []

    # 1) Videos awaiting review — the core Video Review signal.
    subs = db.execute(
        select(Submission.id, Submission.created_at, Campaign.name, CreatorProfile.display_name)
        .join(Campaign, Submission.campaign_id == Campaign.id)
        .outerjoin(CreatorProfile, CreatorProfile.creator_id == Submission.creator_id)
        .where(Submission.verification_status == "pending", Submission.is_suspicious.is_(False))
        .order_by(Submission.created_at.desc())
        .limit(LIMIT)
    ).all()
    for sid, created, campaign_name, display_name in subs:
        items.append(AdminNotification(
            id=f"sub:{sid}", kind="video_submission", title="New video to review",
            body=f'{_name(display_name)} submitted a video to "{campaign_name}".',
            link="/admin/video-review", created_at=created,
        ))

    # 2) Brand-new applicants (joined, not yet actioned by any admin).
    apps = db.execute(
        select(CampaignParticipation.id, CampaignParticipation.joined_at, Campaign.name, CreatorProfile.display_name)
        .join(Campaign, CampaignParticipation.campaign_id == Campaign.id)
        .outerjoin(CreatorProfile, CreatorProfile.creator_id == CampaignParticipation.creator_id)
        .where(CampaignParticipation.status == "joined")
        .order_by(CampaignParticipation.joined_at.desc())
        .limit(LIMIT)
    ).all()
    for pid, joined, campaign_name, display_name in apps:
        items.append(AdminNotification(
            id=f"app:{pid}", kind="applicant", title="New applicant",
            body=f'{_name(display_name)} applied to "{campaign_name}".',
            link="/admin/applicants", created_at=joined,
        ))

    items.sort(key=lambda n: n.created_at, reverse=True)
    return items[:LIMIT]
