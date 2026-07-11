"""Admin campaign overview: the stat tiles + active-creator list on the detail page.

Kept grounded to data we actually have. SideShift's board shows "Ghost Handles"
and campaign-scoped "Pending Invites" — concepts this app doesn't model — so the
tiles here are the real equivalents (creators on the campaign, how many have
delivered, spend to date) rather than inventing placeholder metrics.
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.integrations import storage
from app.models import (
    CampaignParticipation,
    Creator,
    CreatorProfile,
    PayoutItem,
    StorageObject,
    Submission,
)


def _avatar_url(db: Session, prof: CreatorProfile | None) -> str | None:
    if prof is None or not prof.avatar_object_id:
        return None
    obj = db.get(StorageObject, prof.avatar_object_id)
    return storage.object_public_url(obj.object_key) if obj else None


def overview(db: Session, campaign_id: uuid.UUID) -> dict:
    parts = db.scalars(
        select(CampaignParticipation).where(
            CampaignParticipation.campaign_id == campaign_id,
            CampaignParticipation.removed_at.is_(None),
        )
    ).all()
    creator_ids = [p.creator_id for p in parts]

    # per-creator submission rollups for this campaign, in one grouped query
    sub_rows = db.execute(
        select(
            Submission.creator_id,
            func.count(Submission.id).label("posts"),
            func.coalesce(func.sum(Submission.views), 0).label("views"),
            func.coalesce(func.sum(Submission.estimated_amount), 0).label("earned"),
        )
        .where(Submission.campaign_id == campaign_id)
        .group_by(Submission.creator_id)
    ).all()
    by_creator = {r.creator_id: r for r in sub_rows}

    # Spend to date = what's actually been paid out on this campaign's submissions.
    spend = db.scalar(
        select(func.coalesce(func.sum(PayoutItem.amount), 0))
        .join(Submission, Submission.id == PayoutItem.submission_id)
        .where(Submission.campaign_id == campaign_id, PayoutItem.voided_at.is_(None))
    ) or Decimal(0)

    profiles = {
        p.creator_id: p
        for p in db.scalars(select(CreatorProfile).where(CreatorProfile.creator_id.in_(creator_ids or [uuid.uuid4()]))).all()
    }
    emails = {
        c.id: c.email
        for c in db.scalars(select(Creator).where(Creator.id.in_(creator_ids or [uuid.uuid4()]))).all()
    }

    creators = []
    delivered = 0
    for p in parts:
        stats = by_creator.get(p.creator_id)
        posts = int(stats.posts) if stats else 0
        if posts:
            delivered += 1
        prof = profiles.get(p.creator_id)
        creators.append({
            "creator_id": str(p.creator_id),
            "display_name": (prof.display_name if prof else None) or emails.get(p.creator_id, "Creator"),
            "avatar_url": _avatar_url(db, prof),
            "status": p.status,
            "posts": posts,
            "views": int(stats.views) if stats else 0,
            "earned": Decimal(stats.earned) if stats else Decimal(0),
            "joined_at": p.joined_at,
        })
    creators.sort(key=lambda c: (-c["posts"], -c["views"]))

    from app.services import campaign_invites
    return {
        "active_creators": len(parts),
        "delivered_creators": delivered,     # have posted at least once
        "pending_invites": campaign_invites.pending_count(db, campaign_id),
        "total_posts": sum(c["posts"] for c in creators),
        "total_views": sum(c["views"] for c in creators),
        "total_spend": Decimal(spend),
        "creators": creators,
    }
