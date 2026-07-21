"""Public, unauthenticated client report (Feature 6, BUILD_SPEC.md §3.7).

GET /public/report/{token} — the brand-facing "read-only performance page":
same aggregation as app/routers/client/campaigns.py's dashboard, but scoped
to one campaign, gated by a random share_token instead of a client login,
and with every PII field (email, phone, address, city/country, DOB) removed
before it ever reaches the response model. Only creator display_name +
avatar_url are surfaced — see PublicReportSubmissionRow.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.integrations import storage
from app.models import Campaign, CreatorProfile, StorageObject, Submission
from app.schemas.public_report import PublicReportOut, PublicReportSubmissionRow

router = APIRouter(prefix="/public/report", tags=["public-report"])


def _avatar_urls(db: Session, obj_ids: set) -> dict:
    if not obj_ids:
        return {}
    rows = db.scalars(select(StorageObject).where(StorageObject.id.in_(obj_ids))).all()
    return {o.id: storage.object_public_url(o.object_key) for o in rows}


@router.get("/{token}", response_model=PublicReportOut)
def get_report(token: str, db: Session = Depends(get_db)):
    campaign = db.scalar(
        select(Campaign).where(Campaign.share_token == token, Campaign.share_enabled.is_(True))
    )
    if campaign is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")

    # ── aggregate stats (mirrors client/campaigns.py's _stats) ──────────────
    agg = db.execute(
        select(
            func.coalesce(func.sum(Submission.views), 0),
            func.coalesce(func.sum(Submission.likes), 0),
            func.coalesce(func.sum(Submission.comments), 0),
            func.count(Submission.id),
            func.count(func.distinct(Submission.creator_id)),
        ).where(
            Submission.campaign_id == campaign.id,
            Submission.is_suspicious.is_(False),
            Submission.verification_status == "verified",
        )
    ).one()
    total_views, total_likes, total_comments, submission_count, creator_count = agg
    engagement_rate = (total_likes + total_comments) / max(total_views, 1)

    # ── submissions, joined to display_name + avatar only (no PII) ─────────
    rows = db.execute(
        select(Submission, CreatorProfile.display_name, CreatorProfile.avatar_object_id)
        .outerjoin(CreatorProfile, CreatorProfile.creator_id == Submission.creator_id)
        .where(
            Submission.campaign_id == campaign.id,
            Submission.is_suspicious.is_(False),
            Submission.verification_status == "verified",
        )
        .order_by(Submission.created_at.desc())
        .limit(200)
    ).all()

    avatar_map = _avatar_urls(db, {oid for _, _, oid in rows if oid})

    submissions = [
        PublicReportSubmissionRow(
            id=str(sub.id),
            creator_display_name=display_name,
            creator_avatar_url=avatar_map.get(avatar_object_id),
            platform=sub.platform,
            post_url=sub.post_url,
            thumbnail_url=sub.thumbnail_url,
            views=sub.views,
            likes=sub.likes,
            comments=sub.comments,
            submitted_at=sub.created_at,
        )
        for sub, display_name, avatar_object_id in rows
    ]

    return PublicReportOut(
        campaign_id=str(campaign.id),
        slug=campaign.slug,
        name=campaign.name,
        brand_name=campaign.brand_name,
        banner_url=campaign.banner_url,
        status=campaign.status,
        mode=campaign.mode,
        published_at=campaign.published_at,
        total_views=total_views,
        total_likes=total_likes,
        total_comments=total_comments,
        engagement_rate=engagement_rate,
        submission_count=submission_count,
        creator_count=creator_count,
        submissions=submissions,
    )
