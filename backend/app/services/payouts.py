"""Admin payouts. A submission is payable once its earning is VERIFIED and not
already covered by an active payout_item (golden rule 5: at most one active
payout_item per submission — the DB partial-unique index enforces it, so a
double-record races to a 409 rather than paying twice).

'Record payout' settles a creator's outstanding verified earnings in one Payout
(status=paid) — the owner sends the money out-of-band (PayPal/Solana/Whop) and
records it here. Real provider transfers are a later integration.
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import _now
from app.models import CreatorProfile, Payout, PayoutItem, Submission
from app.services import audit

_CENTS = Decimal("0.01")


def _active_items_subq():
    return select(PayoutItem.submission_id).where(PayoutItem.voided_at.is_(None))


def _unpaid_verified(db: Session, creator_id: uuid.UUID):
    return db.scalars(
        select(Submission).where(
            Submission.verification_status == "verified",
            Submission.creator_id == creator_id,
            Submission.id.not_in(_active_items_subq()),
        )
    ).all()


def amounts_owed(db: Session):
    """Per-creator outstanding verified earnings not yet in an active payout.
    Includes the creator's declared payout method/address so the admin's
    'Pay now' modal can pre-fill it instead of guessing."""
    return db.execute(
        select(
            Submission.creator_id,
            CreatorProfile.display_name,
            func.count().label("n"),
            func.coalesce(func.sum(Submission.estimated_amount), 0).label("owed"),
            CreatorProfile.payout_method,
            CreatorProfile.payout_address,
        )
        .outerjoin(CreatorProfile, CreatorProfile.creator_id == Submission.creator_id)
        .where(
            Submission.verification_status == "verified",
            Submission.id.not_in(_active_items_subq()),
        )
        .group_by(Submission.creator_id, CreatorProfile.display_name,
                 CreatorProfile.payout_method, CreatorProfile.payout_address)
        .order_by(func.sum(Submission.estimated_amount).desc())
    ).all()


def list_payouts(db: Session, limit: int = 50):
    return db.execute(
        select(Payout, CreatorProfile.display_name)
        .outerjoin(CreatorProfile, CreatorProfile.creator_id == Payout.creator_id)
        .order_by(Payout.created_at.desc())
        .limit(limit)
    ).all()


def log_manual_payment(db: Session, admin_id: uuid.UUID, creator_id: uuid.UUID,
                       amount: Decimal, method: str, reference: str = "") -> Payout:
    """Clippers-style receipt: money moved in another app, admin logs it here.
    No payout_items — it doesn't claim submissions, it's pure bookkeeping."""
    amount = Decimal(amount).quantize(_CENTS)
    if amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Amount must be positive")
    payout = Payout(creator_id=creator_id, amount=amount, method=method, status="paid",
                    processed_by=admin_id, paid_at=_now(),
                    external_ref=reference.strip() or None)
    db.add(payout)
    db.flush()
    audit.log(db, actor_admin_id=admin_id, action="payout.manual", entity_type="payout",
             entity_id=payout.id, creator_id=str(creator_id), amount=str(amount), method=method)
    db.commit()
    db.refresh(payout)
    return payout


def record_payout_for_submission(db: Session, admin_id: uuid.UUID, submission_id: uuid.UUID,
                                 method: str, reference: str = "") -> Payout:
    """Per-submission payout ('Log payout' on the admin submission modal).
    Pays exactly this one submission's estimated earnings and marks it settled
    via a single PayoutItem (the active-unique index prevents double-paying)."""
    sub = db.get(Submission, submission_id)
    if sub is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    if db.scalar(select(PayoutItem.id).where(
            PayoutItem.submission_id == submission_id, PayoutItem.voided_at.is_(None))):
        raise HTTPException(status.HTTP_409_CONFLICT, "This submission has already been paid")
    amount = Decimal(sub.estimated_amount).quantize(_CENTS)
    if amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This submission has no payable earnings yet")

    payout = Payout(creator_id=sub.creator_id, amount=amount, method=method, status="paid",
                    processed_by=admin_id, paid_at=_now(), external_ref=reference.strip() or None)
    db.add(payout)
    try:
        db.flush()
        db.add(PayoutItem(payout_id=payout.id, submission_id=submission_id, amount=amount))
        audit.log(db, actor_admin_id=admin_id, action="payout.record_submission", entity_type="payout",
                 entity_id=payout.id, creator_id=str(sub.creator_id), amount=str(amount),
                 method=method, submission_id=str(submission_id))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "This submission was just paid by someone else — refresh")
    db.refresh(payout)
    return payout


def record_payout(db: Session, admin_id: uuid.UUID, creator_id: uuid.UUID, method: str) -> Payout:
    subs = _unpaid_verified(db, creator_id)
    # Only settle rows that round to a positive cent — the DB CHECK is amount > 0,
    # and paying $0.00 items would 500 or strand a zero payout.
    items = [(s.id, Decimal(s.estimated_amount).quantize(_CENTS)) for s in subs]
    items = [(sid, amt) for sid, amt in items if amt > 0]
    if not items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No payable verified earnings for this creator")
    total = sum((amt for _, amt in items), Decimal(0))

    payout = Payout(creator_id=creator_id, amount=total, method=method, status="paid",
                    processed_by=admin_id, paid_at=_now())
    db.add(payout)
    try:
        db.flush()  # assign payout.id before linking items
        for sub_id, amt in items:
            db.add(PayoutItem(payout_id=payout.id, submission_id=sub_id, amount=amt))
        audit.log(db, actor_admin_id=admin_id, action="payout.record", entity_type="payout",
                 entity_id=payout.id, creator_id=str(creator_id), amount=str(total),
                 method=method, submission_count=len(items))
        db.commit()  # active-unique index fires here if a submission was just claimed
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "These earnings were just paid by someone else — refresh")
    db.refresh(payout)
    return payout
