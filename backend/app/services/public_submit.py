"""Public (no-auth) campaign submission — the creator-acquisition funnel.

A stranger picks a campaign, submits an email + post URL, then sets a
password on the success page. The Creator row created here is exactly the
"invited, no password yet" shape services/auth.py::creator_set_password()
already expects (see its comment) — no other wiring needed to connect the
two once this exists.
"""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Creator, CreatorProfile, Submission
from app.services import campaign as campaign_svc
from app.services import submission as submission_svc


def _norm(email: str) -> str:
    return email.strip().lower()


def _get_or_create_creator(db: Session, email: str) -> Creator:
    email = _norm(email)
    if not email or "@" not in email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A valid email is required")
    creator = db.scalar(select(Creator).where(Creator.email == email))
    if creator is not None:
        if creator.password_hash is not None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "An account with this email exists — please sign in to submit",
            )
        return creator
    creator = Creator(
        email=email, password_hash=None, status="active",
        signup_source="public_submit", email_verified=True,
    )
    db.add(creator)
    db.commit()
    db.refresh(creator)
    return creator


def _get_or_create_profile(db: Session, creator_id: uuid.UUID) -> None:
    exists = db.scalar(select(CreatorProfile.id).where(CreatorProfile.creator_id == creator_id))
    if exists is None:
        db.add(CreatorProfile(creator_id=creator_id))
        db.commit()


def submit_public(db: Session, campaign_slug: str, email: str, post_url: str) -> Submission:
    creator = _get_or_create_creator(db, email)
    _get_or_create_profile(db, creator.id)
    # Public funnel: a stranger has no profile yet, so skip the profile-completeness
    # wall (require_profile=False). Auto-accept still applies so they can submit.
    campaign_svc.join_campaign(db, creator.id, campaign_slug, require_profile=False)
    return submission_svc.create_submission(db, creator.id, campaign_slug, post_url)
