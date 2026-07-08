"""Creator submissions: canonicalize+dedup, snapshot pricing, enqueue a durable scrape job."""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import _now
from app.models import (
    CampaignParticipation, CreatorProfile, PayoutItem, ScrapeJob, StorageObject, Submission,
)
from app.services import campaign as campaign_svc
from app.services import urls
from app.services.gamification import bump_streak_on_submission, refresh_creator_gamification


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
    # Gamification (Feature 7): bump the daily-submission streak now that the
    # insert is durable. Idempotent — recomputed from distinct submission
    # days, so a second submission today doesn't inflate the count. Best
    # effort: never let a streak-refresh hiccup block the submission itself.
    try:
        bump_streak_on_submission(db, creator_id)
        refresh_creator_gamification(db, creator_id)
    except Exception:
        db.rollback()
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


def _has_active_payout(db: Session, submission_id: uuid.UUID) -> bool:
    return db.scalar(
        select(PayoutItem.id).where(
            PayoutItem.submission_id == submission_id, PayoutItem.voided_at.is_(None)
        )
    ) is not None


def claim_submission(db: Session, creator_id: uuid.UUID, submission_id: uuid.UUID) -> Submission:
    """Creator claims a verified submission for payout. Gated on a payout
    method being set — the router turns 'no_payout_method' into the prompt the
    frontend shows as a modal."""
    sub = get_submission(db, creator_id, submission_id)  # 404 if not theirs
    if sub.verification_status != "verified":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "not_verified")
    if _has_active_payout(db, sub.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "already_paid")
    prof = db.scalar(select(CreatorProfile).where(CreatorProfile.creator_id == creator_id))
    if prof is None or not prof.payout_method or not prof.payout_address:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "no_payout_method")
    sub.claimed_at = _now()
    db.commit()
    db.refresh(sub)
    return sub


def attach_proof_video(db: Session, creator_id: uuid.UUID, submission_id: uuid.UUID,
                       storage_object_id: uuid.UUID) -> Submission:
    """Link a finalized proof-video upload to a submission (golden rule 4: create_new
    campaigns need proof-video verification before an admin can verify stats)."""
    sub = get_submission(db, creator_id, submission_id)
    if sub.verification_status == "verified":
        raise HTTPException(status.HTTP_409_CONFLICT, "This submission is already verified")

    obj = db.get(StorageObject, storage_object_id)
    if obj is None or obj.owner_creator_id != creator_id or obj.purpose != "proof_video":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proof video upload not found")
    if obj.status != "finalized":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Finish uploading the proof video first")

    sub.proof_object_id = obj.id
    # Replacing proof after a rejection re-opens the submission for another look.
    if sub.verification_status == "rejected":
        sub.verification_status = "pending"
        sub.verification_note = None
    db.commit()
    db.refresh(sub)
    return sub
