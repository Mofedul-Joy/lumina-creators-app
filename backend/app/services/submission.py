"""Creator submissions: canonicalize+dedup, snapshot pricing, enqueue a durable scrape job."""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import CampaignParticipation, ScrapeJob, Submission
from app.services import campaign as campaign_svc
from app.services import urls


def create_submission(db: Session, creator_id: uuid.UUID, campaign_slug: str, post_url: str) -> Submission:
    campaign = campaign_svc.get_active_campaign(db, campaign_slug)

    participation = db.scalar(
        select(CampaignParticipation).where(
            CampaignParticipation.campaign_id == campaign.id,
            CampaignParticipation.creator_id == creator_id,
        )
    )
    if participation is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Enter the campaign before submitting")

    platform = urls.detect_platform(post_url)
    if platform is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported or unrecognized post URL")
    if platform not in (campaign.platforms or []):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"This campaign does not accept {platform} posts")

    canonical = urls.canonicalize_url(post_url)
    url_hash = urls.url_hash(post_url)
    if db.scalar(select(Submission.id).where(Submission.campaign_id == campaign.id, Submission.url_hash == url_hash)):
        raise HTTPException(status.HTTP_409_CONFLICT, "This post was already submitted to this campaign")

    sub = Submission(
        participation_id=participation.id, campaign_id=campaign.id, creator_id=creator_id,
        post_url=post_url.strip(), canonical_url=canonical, url_hash=url_hash, platform=platform,
        cpm_rate_snapshot=campaign.cpm_rate, eligible_view_pct_snapshot=campaign.eligible_view_pct,
    )
    db.add(sub)
    db.flush()  # get sub.id before creating its job
    db.add(ScrapeJob(submission_id=sub.id))  # status 'queued', next_run_at now() by default
    try:
        db.commit()
    except IntegrityError:
        # Concurrent submit of the same post won the unique (campaign_id, url_hash)
        # race between the pre-check above and this commit.
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "This post was already submitted to this campaign")
    db.refresh(sub)
    return sub


def list_submissions(db: Session, creator_id: uuid.UUID):
    return db.scalars(
        select(Submission).where(Submission.creator_id == creator_id).order_by(Submission.created_at.desc())
    ).all()


def get_submission(db: Session, creator_id: uuid.UUID, submission_id: uuid.UUID) -> Submission:
    sub = db.get(Submission, submission_id)
    if sub is None or sub.creator_id != creator_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    return sub
