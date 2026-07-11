"""Auth logic for all three realms. Routers stay thin; this owns the rules."""
from __future__ import annotations

import hmac
import secrets
import uuid
from datetime import timedelta

import jwt
from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (
    _now,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.integrations import email as email_svc
from app.models import Admin, Client, Creator, RefreshToken

MIN_PASSWORD = 8
CODE_TTL_MIN = 15
RESEND_COOLDOWN_SEC = 60
MAX_CODE_ATTEMPTS = 5
_MODELS = {"creator": Creator, "admin": Admin, "client": Client}


def _issue_email_code(db: Session, creator: Creator) -> str:
    """Generate + store (hashed) a 6-digit code and email it. Returns the code.
    In production a delivery failure is surfaced (503) so the user isn't left
    with an un-received code; in dev the code is returned in the response instead."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    creator.email_verification_code_hash = hash_token(code)
    creator.email_verification_expires_at = _now() + timedelta(minutes=CODE_TTL_MIN)
    creator.email_verification_sent_at = _now()
    creator.email_verification_attempts = 0
    db.commit()
    try:
        sent = email_svc.send_verification_code(creator.email, code)
    except Exception:  # noqa: BLE001
        sent = False
    if not sent and get_settings().is_production:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "We couldn't send your verification email right now — please try again shortly.",
        )
    return code


def _code_recently_sent(creator: Creator) -> bool:
    last = creator.email_verification_sent_at
    return bool(last and (_now() - last).total_seconds() < RESEND_COOLDOWN_SEC)


def _dev_code(code: str) -> str | None:
    """Expose the code in the API response only outside production (local/E2E)."""
    return None if get_settings().is_production else code


def _norm(email: str) -> str:
    return email.strip().lower()


def _issue(db: Session, subject_id, aud: str) -> tuple[str, str]:
    access = create_access_token(str(subject_id), aud)
    refresh, jti, exp = create_refresh_token(str(subject_id), aud)
    db.add(RefreshToken(
        subject_id=subject_id, subject_type=aud, jti=uuid.UUID(jti),
        token_hash=hash_token(refresh), expires_at=exp,
    ))
    db.commit()
    return access, refresh


def _require_strong(password: str) -> None:
    if len(password) < MIN_PASSWORD:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Password must be at least {MIN_PASSWORD} characters")


# ---- creator ----
def creator_signup(db: Session, email: str, password: str, invite: str | None = None) -> dict:
    """Create the account UNVERIFIED and email a code. No token until verified."""
    email = _norm(email)
    _require_strong(password)
    if db.scalar(select(Creator).where(Creator.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    verify_on = get_settings().require_email_verification
    creator = Creator(email=email, password_hash=hash_password(password), status="active",
                      signup_source="self", email_verified=not verify_on)
    db.add(creator)
    db.commit()
    db.refresh(creator)
    if invite:
        # Invited creators run the exact same signup + onboarding — the invite is
        # only recorded as used. Best-effort: a stale token must never fail a
        # signup that has already succeeded.
        from app.services import invites as invites_svc
        invites_svc.accept(db, invite, creator.id)
    if not verify_on:
        # Email verification disabled (no email provider configured) — issue a token.
        access, refresh = _issue(db, creator.id, "creator")
        return {"status": "ok", "access_token": access, "refresh_token": refresh}
    code = _issue_email_code(db, creator)
    return {"status": "verification_sent", "email": email, "dev_code": _dev_code(code)}


def verify_email_code(db: Session, email: str, code: str) -> tuple[str, str]:
    email = _norm(email)
    creator = db.scalar(select(Creator).where(Creator.email == email))
    bad = HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired code")
    if creator is None or creator.email_verified:
        raise bad
    if not creator.email_verification_code_hash or creator.email_verification_expires_at is None:
        raise bad
    if _now() > creator.email_verification_expires_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This code has expired — request a new one")
    # Brute-force lockout: after too many wrong guesses, kill the code (force a resend).
    if creator.email_verification_attempts >= MAX_CODE_ATTEMPTS:
        creator.email_verification_code_hash = None
        creator.email_verification_expires_at = None
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Too many attempts — request a new code")
    if not hmac.compare_digest(hash_token(code.strip()), creator.email_verification_code_hash):
        creator.email_verification_attempts += 1
        db.commit()
        raise bad
    creator.email_verified = True
    creator.email_verification_code_hash = None
    creator.email_verification_expires_at = None
    creator.email_verification_attempts = 0
    db.commit()
    return _issue(db, creator.id, "creator")


def resend_email_code(db: Session, email: str) -> dict:
    # Always return the same generic 200 so this can't be used to probe whether an
    # email exists or is verified. Cooldown is enforced silently.
    email = _norm(email)
    creator = db.scalar(select(Creator).where(Creator.email == email))
    if creator is None or creator.email_verified or _code_recently_sent(creator):
        return {"status": "ok", "dev_code": None}
    try:
        code = _issue_email_code(db, creator)
    except HTTPException:
        return {"status": "ok", "dev_code": None}
    return {"status": "ok", "dev_code": _dev_code(code)}


def creator_login(db: Session, email: str, password: str):
    email = _norm(email)
    creator = db.scalar(select(Creator).where(Creator.email == email))
    if creator is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if creator.password_hash is None:
        return {"status": "password_not_set", "email": email}
    if not verify_password(password, creator.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if creator.status == "suspended":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is suspended")
    if not creator.email_verified and get_settings().require_email_verification:
        # Route to verification. Only (re)send a code if one wasn't just sent, so
        # repeated logins can't email-bomb the user or churn a valid code.
        if not _code_recently_sent(creator):
            try:
                _issue_email_code(db, creator)
            except HTTPException:
                pass  # verify page has a resend button
        return {"status": "email_not_verified", "email": email}
    access, refresh = _issue(db, creator.id, "creator")
    return {"status": "ok", "access_token": access, "refresh_token": refresh}


def creator_set_password(db: Session, email: str, password: str) -> tuple[str, str]:
    email = _norm(email)
    _require_strong(password)
    creator = db.scalar(select(Creator).where(Creator.email == email))
    # Only valid for an invited/migrated account that has no password yet.
    # NOTE (security): this still trusts the email alone. Before the admin-invite
    # feature ships, gate first-password on a signed/expiring invite token emailed
    # to the address (so a stranger can't claim an invited account first). Today
    # no code path creates null-password accounts, so this is not yet reachable.
    if creator is None or creator.password_hash is not None or creator.signup_source == "self":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot set password for this account")
    creator.password_hash = hash_password(password)
    db.commit()
    return _issue(db, creator.id, "creator")


def creator_check_email(db: Session, email: str) -> dict:
    creator = db.scalar(select(Creator).where(Creator.email == _norm(email)))
    return {"exists": creator is not None, "password_set": bool(creator and creator.password_hash)}


# ---- admin / client (simple password login) ----
def _password_login(db: Session, model, aud: str, email: str, password: str) -> tuple[str, str]:
    obj = db.scalar(select(model).where(model.email == _norm(email)))
    if obj is None or obj.password_hash is None or not verify_password(password, obj.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if getattr(obj, "is_active", True) is False:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")
    if getattr(obj, "status", "active") == "suspended":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is suspended")
    return _issue(db, obj.id, aud)


def admin_login(db: Session, email: str, password: str) -> tuple[str, str]:
    return _password_login(db, Admin, "admin", email, password)


def client_login(db: Session, email: str, password: str) -> tuple[str, str]:
    return _password_login(db, Client, "client", email, password)


# ---- refresh (rotation + reuse detection) ----
def rotate_refresh(db: Session, token: str, aud: str) -> tuple[str, str]:
    try:
        payload = decode_token(token, aud)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
    jti = uuid.UUID(payload["jti"])
    subject_id = uuid.UUID(payload["sub"])
    from app.core.security import _now  # local import to reuse the tz-aware clock

    # Atomically claim the token: only ONE concurrent refresh can flip
    # revoked_at from NULL, so a race can't mint two token families.
    result = db.execute(
        update(RefreshToken)
        .where(RefreshToken.jti == jti, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )
    if result.rowcount == 0:
        # Unknown jti or already-rotated token -> reuse. Revoke the whole family.
        db.commit()
        _revoke_family(db, subject_id, aud)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token reuse detected")
    db.commit()
    # A disabled/suspended account must not rotate into fresh tokens.
    from app.core.deps import _is_disabled
    subject = db.get(_MODELS[aud], subject_id)
    if subject is None or _is_disabled(subject):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is disabled")
    return _issue(db, subject_id, aud)


def _revoke_family(db: Session, subject_id, aud: str) -> None:
    from app.core.security import _now
    rows = db.scalars(
        select(RefreshToken).where(
            RefreshToken.subject_id == subject_id,
            RefreshToken.subject_type == aud,
            RefreshToken.revoked_at.is_(None),
        )
    ).all()
    for r in rows:
        r.revoked_at = _now()
    db.commit()
