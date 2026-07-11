"""Creator invites: email an address and/or hand out a shareable join link.

Both cases are the same row — an invite with an email also gets a message sent
to it, an invite without one is just a link. Accepting is idempotent and only
records who the invite produced; the signup itself is the normal creator signup,
so an invited creator lands in the same onboarding flow as a self-signup.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import _now
from app.integrations import email as email_svc
from app.models import Creator, CreatorInvite

INVITE_TTL_DAYS = 30


def _link(token: str) -> str:
    base = (get_settings().frontend_url or "").rstrip("/")
    return f"{base}/signup?invite={token}"


def create_invite(db: Session, admin_id: uuid.UUID, email: str | None) -> dict:
    addr = (email or "").strip().lower() or None

    if addr and db.scalar(select(Creator.id).where(Creator.email == addr)):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "That email already has a Lumina Creators account.",
        )

    inv = CreatorInvite(
        token=secrets.token_urlsafe(24),
        email=addr,
        created_by_admin_id=admin_id,
        expires_at=_now() + timedelta(days=INVITE_TTL_DAYS),
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    link = _link(inv.token)
    sent = False
    if addr:
        # A mail transport that isn't configured must not fail the invite — the
        # admin still gets a working link to share by hand.
        try:
            sent = email_svc.send_creator_invite(addr, link)
        except Exception:  # noqa: BLE001
            sent = False
        if sent:
            inv.email_sent = True
            db.commit()

    return {
        "id": str(inv.id),
        "email": inv.email,
        "link": link,
        "email_sent": sent,
        "accepted": False,
        "created_at": inv.created_at,
    }


def list_invites(db: Session) -> list[dict]:
    rows = db.scalars(select(CreatorInvite).order_by(CreatorInvite.created_at.desc())).all()
    return [
        {
            "id": str(i.id),
            "email": i.email,
            "link": _link(i.token),
            "email_sent": i.email_sent,
            "accepted": i.accepted_at is not None,
            "created_at": i.created_at,
        }
        for i in rows
    ]


def revoke_invite(db: Session, invite_id: uuid.UUID) -> None:
    inv = db.get(CreatorInvite, invite_id)
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")
    db.delete(inv)
    db.commit()


def peek(db: Session, token: str) -> dict:
    """Public: what the signup page shows when opened from an invite link."""
    inv = db.scalar(select(CreatorInvite).where(CreatorInvite.token == token))
    if inv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That invite link is not valid.")
    if inv.expires_at and inv.expires_at < _now():
        raise HTTPException(status.HTTP_410_GONE, "That invite link has expired.")
    return {"email": inv.email, "accepted": inv.accepted_at is not None}


def accept(db: Session, token: str, creator_id: uuid.UUID) -> None:
    """Mark an invite used. Best-effort: a bad/expired token must never fail a
    signup that already succeeded — the creator exists either way."""
    inv = db.scalar(select(CreatorInvite).where(CreatorInvite.token == token))
    if inv is None or inv.accepted_at is not None:
        return
    inv.accepted_at = _now()
    inv.accepted_creator_id = creator_id
    db.commit()
