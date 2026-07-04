"""Admin submission review: filterable list + verify/reject.

Verification is the create_new proof gate (golden rule 4): admins mark a
submission verified or rejected. Earnings are already snapshot-priced on the
submission, so review never rewrites money — it only gates payout eligibility.
"""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.security import _now
from app.models import Campaign, Creator, CreatorProfile, PayoutItem, Submission
from app.services import audit


def _has_active_payout(db: Session, submission_id: uuid.UUID) -> bool:
    return db.scalar(
        select(PayoutItem.id).where(
            PayoutItem.submission_id == submission_id, PayoutItem.voided_at.is_(None)
        )
    ) is not None


def list_submissions(db: Session, *, campaign_id=None, verification_status=None,
                     platform=None, suspicious: bool | None = None, limit=100, offset=0):
    stmt = (
        select(Submission, Campaign.name, Campaign.mode, CreatorProfile.display_name, Creator.is_suspicious)
        .join(Campaign, Submission.campaign_id == Campaign.id)
        .outerjoin(CreatorProfile, CreatorProfile.creator_id == Submission.creator_id)
        .outerjoin(Creator, Creator.id == Submission.creator_id)
    )
    if campaign_id:
        stmt = stmt.where(Submission.campaign_id == campaign_id)
    if verification_status:
        stmt = stmt.where(Submission.verification_status == verification_status)
    if platform:
        stmt = stmt.where(Submission.platform == platform)
    if suspicious is True:
        stmt = stmt.where(or_(Submission.is_suspicious.is_(True), Creator.is_suspicious.is_(True)))
    else:
        # Default view (suspicious is None or False): hide anything flagged
        # at either level, same as an admin who never asked to see them.
        stmt = stmt.where(Submission.is_suspicious.is_(False), Creator.is_suspicious.isnot(True))
    # Unavailable posts sort to the very back, embed-broken (but confirmed
    # live) second-to-back, healthy rows newest-first — dead links shouldn't
    # crowd out the submissions that actually need review.
    stmt = stmt.order_by(
        Submission.post_unavailable.asc(),
        Submission.embed_broken.asc(),
        Submission.created_at.desc(),
    ).limit(limit).offset(offset)
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
    audit.log(db, actor_admin_id=admin_id, action="submission.verify",
             entity_type="submission", entity_id=sub.id)
    db.commit()
    db.refresh(sub)
    return sub


def reject_submission(db: Session, admin_id: uuid.UUID, submission_id: uuid.UUID, note: str) -> Submission:
    sub = _get(db, submission_id)
    sub.verification_status = "rejected"
    sub.verified_by = admin_id
    sub.verified_at = _now()
    sub.verification_note = note.strip() or None
    audit.log(db, actor_admin_id=admin_id, action="submission.reject",
             entity_type="submission", entity_id=sub.id, note=sub.verification_note)
    db.commit()
    db.refresh(sub)
    return sub


def set_suspicious(db: Session, submission_id: uuid.UUID, flagged: bool,
                   admin_id: uuid.UUID | None = None) -> Submission:
    """Flag this one post, independent of the creator's account-level flag."""
    sub = db.get(Submission, submission_id)
    if sub is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    sub.is_suspicious = flagged
    audit.log(db, actor_admin_id=admin_id, entity_type="submission", entity_id=sub.id,
             action="submission.flag_suspicious" if flagged else "submission.unflag_suspicious")
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
