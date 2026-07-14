"""Admin "Remove creator".

Two independent choices, mirroring the reference platform's popup:

  mode  — what happens to their data
    delete_all      purge everything we're allowed to purge
    keep_analytics  off every campaign, but posts + views keep tracking
    keep_posts      existing posts keep earning; no new post is tracked

  scope — how much access they lose
    campaigns_only  detached from campaigns, account still works
    entire          also suspended — no access at all

`payouts` and `campaign_participations` are ON DELETE RESTRICT against creators
and submissions hang off participation rows, so removal is state, not deletion.
Under `delete_all` a creator who has never been paid is hard-deleted; one with a
payout ledger is scrubbed of PII and tombstoned instead, because destroying the
rows a payout points at would break financial integrity (CONTEXT.md rule 5).
"""
from __future__ import annotations

import secrets
import uuid

from fastapi import HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.core.security import _now, hash_password
from app.models import (
    CampaignParticipation,
    Creator,
    CreatorExperience,
    CreatorProfile,
    PayoutItem,
    PortfolioItem,
    ScrapeJob,
    SocialAccount,
    Submission,
)

MODES = ("delete_all", "keep_analytics", "keep_posts")
SCOPES = ("campaigns_only", "entire")


def _has_payouts(db: Session, creator_id: uuid.UUID) -> bool:
    return db.scalar(
        select(PayoutItem.id)
        .join(Submission, Submission.id == PayoutItem.submission_id)
        .where(Submission.creator_id == creator_id)
        .limit(1)
    ) is not None


def _detach_from_campaigns(db: Session, creator_id: uuid.UUID) -> int:
    """Mark every live participation removed. Rows stay — submissions point at them."""
    res = db.execute(
        update(CampaignParticipation)
        .where(
            CampaignParticipation.creator_id == creator_id,
            CampaignParticipation.removed_at.is_(None),
        )
        .values(removed_at=_now())
    )
    return res.rowcount or 0


def _cancel_pending_scrapes(db: Session, creator_id: uuid.UUID) -> None:
    """Stop future tracking: drop scrape jobs that haven't run for this creator."""
    sub_ids = select(Submission.id).where(Submission.creator_id == creator_id)
    db.execute(
        delete(ScrapeJob).where(
            ScrapeJob.submission_id.in_(sub_ids),
            ScrapeJob.status.in_(("queued", "failed")),
        )
    )


def _purge_personal_data(db: Session, creator_id: uuid.UUID) -> None:
    """Everything that is theirs alone and no financial row depends on."""
    for model in (CreatorExperience, PortfolioItem, SocialAccount):
        db.execute(delete(model).where(model.creator_id == creator_id))
    db.execute(delete(CreatorProfile).where(CreatorProfile.creator_id == creator_id))


def remove_creator(db: Session, creator_id: uuid.UUID, mode: str, scope: str) -> dict:
    if mode not in MODES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid removal mode")
    if scope not in SCOPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid removal scope")

    creator = db.get(Creator, creator_id)
    if creator is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Creator not found")

    email = creator.email
    detached = _detach_from_campaigns(db, creator_id)
    hard_deleted = False
    retained_ledger = False

    if mode == "delete_all":
        _cancel_pending_scrapes(db, creator_id)
        if _has_payouts(db, creator_id):
            # They've been paid. Scrub the person, keep the money trail.
            retained_ledger = True
            _purge_personal_data(db, creator_id)
            creator.email = f"removed+{creator_id}@lumina.invalid"
            # NOT None: chk_self_signup_has_password forbids a self-signup row
            # with a null password. Scramble it to something nobody can know —
            # that locks the account out and keeps the constraint satisfied.
            creator.password_hash = hash_password(secrets.token_urlsafe(32))
            creator.status = "suspended"
            creator.tracking_disabled = True
        else:
            # Never paid — nothing financial depends on them, so really delete.
            db.execute(delete(Submission).where(Submission.creator_id == creator_id))
            db.execute(
                delete(CampaignParticipation).where(CampaignParticipation.creator_id == creator_id)
            )
            _purge_personal_data(db, creator_id)
            db.delete(creator)          # cascades storage_objects, payment_methods
            db.commit()
            return {
                "removed": True, "mode": mode, "scope": scope, "email": email,
                "campaigns_detached": detached, "hard_deleted": True,
                "retained_ledger": False,
            }

    elif mode == "keep_analytics":
        # Off every campaign, but their posts and view counts keep updating.
        pass

    elif mode == "keep_posts":
        # Existing posts still earn; nothing new gets tracked.
        creator.tracking_disabled = True
        _cancel_pending_scrapes(db, creator_id)

    if scope == "entire":
        creator.status = "suspended"

    creator.removed_at = _now()
    creator.removal_mode = mode
    db.commit()

    return {
        "removed": True, "mode": mode, "scope": scope, "email": email,
        "campaigns_detached": detached, "hard_deleted": hard_deleted,
        "retained_ledger": retained_ledger,
    }


def reactivate_creator(db: Session, creator_id: uuid.UUID) -> dict:
    """Undo a scope=entire removal (mirrors client suspend/reactivate) — flips a
    suspended creator back to active and re-enables tracking so they can log in,
    join, and submit again. Does NOT restore PII scrubbed by a keep_posts/delete
    removal (that data is gone); it just lifts the access block."""
    creator = db.get(Creator, creator_id)
    if creator is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Creator not found")
    if creator.status != "suspended":
        raise HTTPException(status.HTTP_409_CONFLICT, "This creator is not suspended")
    creator.status = "active"
    creator.tracking_disabled = False
    creator.removed_at = None
    creator.removal_mode = None
    db.commit()
    return {"reactivated": True, "id": str(creator_id), "email": creator.email}
