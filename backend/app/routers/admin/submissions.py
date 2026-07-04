"""Admin submission review: list, verify, reject. Admin-only."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.integrations import storage
from app.models import Admin, Campaign, Creator, CreatorProfile, StorageObject, Submission
from app.schemas.admin_submissions import AdminSubmissionRow, RejectIn, SubmissionCounts
from app.services import admin_submissions as svc

router = APIRouter(prefix="/submissions", tags=["admin-submissions"])


def _proof_url(db: Session, sub: Submission) -> Optional[str]:
    if not sub.proof_object_id:
        return None
    obj = db.get(StorageObject, sub.proof_object_id)
    return storage.object_public_url(obj.object_key) if obj else None


def _row(db: Session, sub: Submission, name: str, mode: str, display_name,
        is_paid: bool = False, creator_is_suspicious: bool = False) -> AdminSubmissionRow:
    return AdminSubmissionRow(
        id=str(sub.id), campaign_id=str(sub.campaign_id), campaign_name=name, campaign_mode=mode,
        creator_id=str(sub.creator_id), creator_name=display_name, platform=sub.platform,
        post_url=sub.post_url, views=sub.views, likes=sub.likes, comments=sub.comments,
        estimated_amount=sub.estimated_amount, verification_status=sub.verification_status,
        scrape_status=sub.scrape_status, status=svc.lifecycle_status(sub, is_paid),
        verification_note=sub.verification_note,
        proof_url=_proof_url(db, sub),
        embed_broken=sub.embed_broken, post_unavailable=sub.post_unavailable,
        is_suspicious=sub.is_suspicious, creator_is_suspicious=creator_is_suspicious,
        thumbnail_url=sub.thumbnail_url, created_at=sub.created_at,
    )


@router.get("", response_model=list[AdminSubmissionRow])
def list_submissions(
    campaign_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    platform: Optional[str] = None,
    suspicious: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    rows = svc.list_submissions(db, campaign_id=campaign_id, verification_status=status,
                                platform=platform, suspicious=suspicious, limit=limit, offset=offset)
    paid = svc.paid_submission_ids(db)
    return [_row(db, sub, name, mode, dn, sub.id in paid, bool(creator_susp)) for sub, name, mode, dn, creator_susp in rows]


@router.get("/counts", response_model=SubmissionCounts)
def counts(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    c = svc.counts_by_status(db)
    return SubmissionCounts(pending=c.get("pending", 0), verified=c.get("verified", 0),
                            rejected=c.get("rejected", 0))


@router.post("/{submission_id}/verify", response_model=AdminSubmissionRow)
def verify(submission_id: uuid.UUID, admin: Admin = Depends(get_current_admin),
           db: Session = Depends(get_db)):
    sub = svc.verify_submission(db, admin.id, submission_id)
    return _reload(db, sub)


@router.post("/{submission_id}/reject", response_model=AdminSubmissionRow)
def reject(submission_id: uuid.UUID, body: RejectIn, admin: Admin = Depends(get_current_admin),
           db: Session = Depends(get_db)):
    sub = svc.reject_submission(db, admin.id, submission_id, body.note)
    return _reload(db, sub)


@router.post("/{submission_id}/flag-suspicious", response_model=AdminSubmissionRow)
def flag_suspicious(submission_id: uuid.UUID, admin: Admin = Depends(get_current_admin),
                    db: Session = Depends(get_db)):
    sub = svc.set_suspicious(db, submission_id, True)
    return _reload(db, sub)


@router.post("/{submission_id}/unflag-suspicious", response_model=AdminSubmissionRow)
def unflag_suspicious(submission_id: uuid.UUID, admin: Admin = Depends(get_current_admin),
                      db: Session = Depends(get_db)):
    sub = svc.set_suspicious(db, submission_id, False)
    return _reload(db, sub)


def _reload(db: Session, sub: Submission) -> AdminSubmissionRow:
    camp = db.get(Campaign, sub.campaign_id)
    prof = db.execute(
        select(CreatorProfile.display_name).where(CreatorProfile.creator_id == sub.creator_id)
    ).scalar()
    creator_susp = db.execute(
        select(Creator.is_suspicious).where(Creator.id == sub.creator_id)
    ).scalar()
    return _row(db, sub, camp.name, camp.mode, prof, sub.id in svc.paid_submission_ids(db), bool(creator_susp))
