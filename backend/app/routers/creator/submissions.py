"""Creator submissions: submit a posted URL, list, detail, claim payout."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_creator
from app.db.session import get_db
from app.models import Creator, PayoutItem, Submission
from app.schemas.submission import ProofVideoAttachIn, SubmissionCreateIn, SubmissionOut
from app.services import submission as svc

router = APIRouter(prefix="/submissions", tags=["creator-submissions"])


def _paid_ids(db: Session, submission_ids: list[uuid.UUID]) -> set:
    if not submission_ids:
        return set()
    return set(db.scalars(
        select(PayoutItem.submission_id).where(
            PayoutItem.submission_id.in_(submission_ids), PayoutItem.voided_at.is_(None)
        )
    ).all())


def _out(s: Submission, is_paid: bool = False) -> SubmissionOut:
    return SubmissionOut(
        id=str(s.id), campaign_id=str(s.campaign_id), post_url=s.post_url, platform=s.platform,
        views=s.views, likes=s.likes, comments=s.comments, estimated_amount=s.estimated_amount,
        payable_amount=s.payable_amount, scrape_status=s.scrape_status,
        verification_status=s.verification_status, verification_note=s.verification_note,
        has_proof_video=s.proof_object_id is not None,
        thumbnail_url=s.thumbnail_url, claimed=s.claimed_at is not None, is_paid=is_paid,
        created_at=s.created_at,
    )


def _out_one(db: Session, s: Submission) -> SubmissionOut:
    return _out(s, bool(_paid_ids(db, [s.id])))


@router.post("", response_model=SubmissionOut)
def submit(body: SubmissionCreateIn, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    return _out(svc.create_submission(db, current.id, body.campaign_slug, body.post_url))


@router.get("", response_model=list[SubmissionOut])
def list_mine(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    subs = svc.list_submissions(db, current.id)
    paid = _paid_ids(db, [s.id for s in subs])
    return [_out(s, s.id in paid) for s in subs]


@router.get("/{submission_id}", response_model=SubmissionOut)
def detail(submission_id: uuid.UUID, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    return _out_one(db, svc.get_submission(db, current.id, submission_id))


@router.patch("/{submission_id}/proof", response_model=SubmissionOut)
def attach_proof(submission_id: uuid.UUID, body: ProofVideoAttachIn,
                 current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    return _out_one(db, svc.attach_proof_video(db, current.id, submission_id, uuid.UUID(body.storage_object_id)))


@router.post("/{submission_id}/claim", response_model=SubmissionOut)
def claim(submission_id: uuid.UUID, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    """Claim a verified submission for payout. Raises 400 'no_payout_method'
    (the frontend shows a set-your-method modal) if none is on file."""
    return _out_one(db, svc.claim_submission(db, current.id, submission_id))
