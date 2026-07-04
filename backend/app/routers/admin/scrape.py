"""Manual embed-health re-checks. Admin-only.

Separate from the scrape worker: this is a direct oEmbed probe an admin can
trigger on demand (e.g. after a creator disputes a "post unavailable" flag),
not a re-scrape of view counts.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models import Admin, Submission
from app.services import embed_health

router = APIRouter(prefix="/scrape", tags=["admin-scrape"])

_MAX_BATCH = 200


class EmbedCheckResult(BaseModel):
    submission_id: str
    embed_broken: bool
    post_unavailable: bool
    verdict: Optional[str] = None  # None = probe was indeterminate, flags unchanged


def _check_one(db: Session, sub: Submission) -> EmbedCheckResult:
    flags = embed_health.probe(sub.platform, sub.post_url)
    if flags is not None:
        sub.embed_broken = flags.embed_broken
        sub.post_unavailable = flags.post_unavailable
        db.commit()
    verdict = None
    if flags is not None:
        verdict = "unavailable" if flags.post_unavailable else ("geo_restricted" if flags.embed_broken else "healthy")
    return EmbedCheckResult(
        submission_id=str(sub.id), embed_broken=sub.embed_broken,
        post_unavailable=sub.post_unavailable, verdict=verdict,
    )


# Declared before the {submission_id} route below — FastAPI matches path
# routes in order, and "batch" would otherwise be parsed as a submission_id.
@router.post("/embed-check/batch", response_model=list[EmbedCheckResult])
def embed_check_batch(submission_ids: list[uuid.UUID], admin: Admin = Depends(get_current_admin),
                      db: Session = Depends(get_db)):
    if len(submission_ids) > _MAX_BATCH:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Max {_MAX_BATCH} submissions per batch")
    out = []
    for sid in submission_ids:
        sub = db.get(Submission, sid)
        if sub is not None:
            out.append(_check_one(db, sub))
    return out


@router.post("/embed-check/{submission_id}", response_model=EmbedCheckResult)
def embed_check_one(submission_id: uuid.UUID, admin: Admin = Depends(get_current_admin),
                    db: Session = Depends(get_db)):
    sub = db.get(Submission, submission_id)
    if sub is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    return _check_one(db, sub)
