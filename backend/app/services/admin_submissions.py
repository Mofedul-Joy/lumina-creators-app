"""Admin submission review: filterable list + verify/reject.

Verification is the create_new proof gate (golden rule 4): admins mark a
submission verified or rejected. Earnings are already snapshot-priced on the
submission, so review never rewrites money — it only gates payout eligibility.
"""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import _now
from app.models import Campaign, CreatorProfile, PayoutItem, Submission


def _has_active_payout(db: Session, submission_id: uuid.UUID) -> bool:
    return db.scalar(
        select(PayoutItem.id).where(
            PayoutItem.submission_id == submission_id, PayoutItem.voided_at.is_(None)
        )
    ) is not None


def list_submissions(db: Session, *, campaign_id=None, verification_status=None,
                     platform=None, limit=100, offset=0):
    stmt = (
        select(Submission, Campaign.name, Campaign.mode, CreatorProfile.display_name)
        .join(Campaign, Submission.campaign_id == Campaign.id)
        .outerjoin(CreatorProfile, CreatorProfile.creator_id == Submission.creator_id)
    )
    if campaign_id:
        stmt = stmt.where(Submission.campaign_id == campaign_id)
    if verification_status:
        stmt = stmt.where(Submission.verification_status == verification_status)
    if platform:
        stmt = stmt.where(Submission.platform == platform)
    stmt = stmt.order_by(Submission.created_at.desc()).limit(limit).offset(offset)
    return db.execute(stmt).all()


def _get(db: Session, submission_id: uuid.UUID) -> Submission:
    sub = db.get(Submission, submission_id)
    if sub is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    # Verification can't change once the earning has been paid out — that would
    # strand a paid payout_item against a rejected submission (golden rule 5).
    if _has_active_payout(db, submission_id):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "This submission has already been paid — void the payout first")
    return sub


def verify_submission(db: Session, admin_id: uuid.UUID, submission_id: uuid.UUID) -> Submission:
    sub = _get(db, submission_id)
    sub.verification_status = "verified"
    sub.verified_by = admin_id
    sub.verified_at = _now()
    sub.verification_note = None
    db.commit()
    db.refresh(sub)
    return sub


def reject_submission(db: Session, admin_id: uuid.UUID, submission_id: uuid.UUID, note: str) -> Submission:
    sub = _get(db, submission_id)
    sub.verification_status = "rejected"
    sub.verified_by = admin_id
    sub.verified_at = _now()
    sub.verification_note = note.strip() or None
    db.commit()
    db.refresh(sub)
    return sub


def counts_by_status(db: Session) -> dict:
    from sqlalchemy import func
    rows = db.execute(
        select(Submission.verification_status, func.count()).group_by(Submission.verification_status)
    ).all()
    return {s: c for s, c in rows}


def paid_submission_ids(db: Session) -> set:
    """Submissions covered by an active (un-voided) payout item."""
    from app.models import PayoutItem
    return set(db.scalars(
        select(PayoutItem.submission_id).where(PayoutItem.voided_at.is_(None))
    ).all())


def lifecycle_status(sub: Submission, is_paid: bool) -> str:
    """Bell's status set, derived from existing fields (no schema change)."""
    if is_paid:
        return "paid"
    if sub.verification_status == "rejected":
        return "rejected"
    if sub.verification_status == "verified":
        return "stats_verified"
    if sub.proof_object_id is not None:
        return "proof_uploaded"
    return "awaiting_stats"
