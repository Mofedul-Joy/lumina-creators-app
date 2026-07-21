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
from app.services import audit, messaging, notifications


def _has_active_payout(db: Session, submission_id: uuid.UUID) -> bool:
    return db.scalar(
        select(PayoutItem.id).where(
            PayoutItem.submission_id == submission_id, PayoutItem.voided_at.is_(None)
        )
    ) is not None


# Review outcome → (bell title, message sentence template). Drives _notify_creator.
_OUTCOMES = {
    "verified": ("Your video was approved", 'Your video for "{c}" was approved.'),
    "rejected": ("Your video was rejected", 'Your video for "{c}" was rejected.'),
    "revision_requested": ("Changes requested on your video",
                           'Your video for "{c}" needs some changes before it can be approved.'),
}


def _notify_creator(db: Session, admin_id: uuid.UUID, sub: Submission,
                    outcome: str, note: str | None) -> None:
    """After a review decision, tell the creator two ways: a bell notification
    and a DM in the message section (with the admin's feedback, if any). Both are
    best-effort — the review is already committed, so a notify hiccup never
    unwinds it (golden rule: notifications are side effects)."""
    title, template = _OUTCOMES.get(outcome, ("Video review update", 'Your video for "{c}" was reviewed.'))
    campaign_name = db.scalar(select(Campaign.name).where(Campaign.id == sub.campaign_id)) or "your campaign"
    line = template.format(c=campaign_name)
    if note:
        line += f"\n\nFeedback from the team: {note}"
    try:
        # Bell body carries the campaign-aware sentence (+ feedback) so the
        # notification alone tells the creator which campaign it's about — the
        # title stays short/generic.
        notifications.push(db, sub.creator_id, kind="video_review",
                           title=title, body=line, link="/submissions")
    except Exception:
        db.rollback()
    try:
        conv = messaging.get_or_create_for_creator(db, sub.creator_id)
        messaging.send_message(db, conv.id, sender_type="admin", body=line, sender_admin_id=admin_id)
    except Exception:
        db.rollback()


def list_submissions(db: Session, *, campaign_id=None, verification_status=None,
                     platform=None, client_id=None, health=None,
                     suspicious: bool | None = None, limit=100, offset=0):
    stmt = (
        select(Submission, Campaign.name, Campaign.mode, CreatorProfile.display_name, Creator.is_suspicious)
        .join(Campaign, Submission.campaign_id == Campaign.id)
        .outerjoin(CreatorProfile, CreatorProfile.creator_id == Submission.creator_id)
        .outerjoin(Creator, Creator.id == Submission.creator_id)
    )
    if campaign_id:
        stmt = stmt.where(Submission.campaign_id == campaign_id)
    if client_id:
        # Scope to one brand: every submission across that client's campaigns.
        stmt = stmt.where(Campaign.client_id == client_id)
    if verification_status:
        stmt = stmt.where(Submission.verification_status == verification_status)
    if platform:
        stmt = stmt.where(Submission.platform == platform)
    if health == "healthy":
        stmt = stmt.where(Submission.post_unavailable.is_(False), Submission.embed_broken.is_(False))
    elif health == "embed_broken":
        stmt = stmt.where(Submission.embed_broken.is_(True))
    elif health == "unavailable":
        stmt = stmt.where(Submission.post_unavailable.is_(True))
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
    was = sub.verification_status
    # Approval = the admin watched the submitted post in Video Reviews and it
    # looks good. The post URL itself is the video, so no separate proof-video
    # upload is required (that legacy gate contradicted the review-and-approve
    # flow). Fraud is caught by the admin's visual review + the is_suspicious flag.
    sub.verification_status = "verified"
    sub.verified_by = admin_id
    sub.verified_at = _now()
    sub.verification_note = None
    sub.revision_mode = None
    audit.log(db, actor_admin_id=admin_id, action="submission.verify",
             entity_type="submission", entity_id=sub.id)
    db.commit()
    db.refresh(sub)
    # Only ping the creator on an actual transition — re-clicking Approve on an
    # already-verified post must not re-spam their bell + DM thread.
    if was != "verified":
        _notify_creator(db, admin_id, sub, "verified", None)
    return sub


_REVISION_MODES = {"edit", "repost"}


def request_revision(db: Session, admin_id: uuid.UUID, submission_id: uuid.UUID,
                     mode: str, note: str = "") -> Submission:
    """Soft-bounce a submission back to the creator for changes — the middle
    ground between verify and reject. `mode` decides how they fix it:
      • 'edit'   — the creator amends this same submission (its link) → pending.
      • 'repost' — the creator must submit a brand-new post; this one stays as
                   revision_requested for the record.
    Never scrapes or pays (the worker is verified-only). Note is optional."""
    if mode not in _REVISION_MODES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "mode must be 'edit' or 'repost'")
    sub = _get(db, submission_id)
    was = sub.verification_status
    sub.verification_status = "revision_requested"
    sub.revision_mode = mode
    sub.verified_by = admin_id
    sub.verified_at = _now()
    sub.verification_note = (note or "").strip() or None
    audit.log(db, actor_admin_id=admin_id, action="submission.request_revision",
             entity_type="submission", entity_id=sub.id, note=sub.verification_note)
    db.commit()
    db.refresh(sub)
    # Notify on transition into revision only; a repeated request on an
    # already-revision post shouldn't re-spam (a fresh note still updates the row).
    if was != "revision_requested":
        _notify_creator(db, admin_id, sub, "revision_requested", sub.verification_note)
    return sub


def reject_submission(db: Session, admin_id: uuid.UUID, submission_id: uuid.UUID, note: str) -> Submission:
    sub = _get(db, submission_id)
    was = sub.verification_status
    sub.verification_status = "rejected"
    sub.verified_by = admin_id
    sub.verified_at = _now()
    sub.verification_note = note.strip() or None
    audit.log(db, actor_admin_id=admin_id, action="submission.reject",
             entity_type="submission", entity_id=sub.id, note=sub.verification_note)
    db.commit()
    db.refresh(sub)
    # Only notify on an actual transition into rejected — no re-spam on re-reject.
    if was != "rejected":
        _notify_creator(db, admin_id, sub, "rejected", sub.verification_note)
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
    """Bell's status set, derived from existing fields."""
    if is_paid:
        return "paid"
    if sub.verification_status == "rejected":
        return "rejected"
    if sub.verification_status == "revision_requested":
        return "revision_requested"
    if sub.claimed_at is not None:
        return "payment_claimed"
    if sub.verification_status == "verified":
        return "stats_verified"
    if sub.verification_status == "pending" and sub.scrape_status == "success":
        return "awaiting_review"
    if sub.proof_object_id is not None:
        return "proof_uploaded"
    return "awaiting_stats"


def delete_submission(db: Session, admin_id: uuid.UUID, submission_id: uuid.UUID) -> None:
    """Hard-delete a submission (and its scrape job). Blocked if it has been
    paid — a paid payout_item must be voided first (golden rule 5)."""
    from app.models import PayoutItem, ScrapeJob
    sub = db.get(Submission, submission_id)
    if sub is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    if _has_active_payout(db, submission_id):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "This submission has been paid — void the payout before deleting")
    # Any PayoutItem still pointing at this submission is VOIDED (the active-payout
    # guard above blocks live ones) — but payout_items.submission_id is ondelete=
    # RESTRICT, so those dead rows would otherwise raise a raw IntegrityError → 500.
    # Remove them first so the delete succeeds cleanly.
    db.execute(PayoutItem.__table__.delete().where(PayoutItem.submission_id == submission_id))
    db.execute(ScrapeJob.__table__.delete().where(ScrapeJob.submission_id == submission_id))
    audit.log(db, actor_admin_id=admin_id, action="submission.delete",
             entity_type="submission", entity_id=submission_id)
    db.delete(sub)
    db.commit()
