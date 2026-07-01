"""Auth logic for all three realms. Routers stay thin; this owns the rules."""
from __future__ import annotations

import uuid

import jwt
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models import Admin, Client, Creator, RefreshToken

MIN_PASSWORD = 8
_MODELS = {"creator": Creator, "admin": Admin, "client": Client}


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
def creator_signup(db: Session, email: str, password: str) -> tuple[str, str]:
    email = _norm(email)
    _require_strong(password)
    if db.scalar(select(Creator).where(Creator.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    creator = Creator(email=email, password_hash=hash_password(password), status="active", signup_source="self")
    db.add(creator)
    db.commit()
    db.refresh(creator)
    return _issue(db, creator.id, "creator")


def creator_login(db: Session, email: str, password: str):
    email = _norm(email)
    creator = db.scalar(select(Creator).where(Creator.email == email))
    if creator is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if creator.password_hash is None:
        return {"status": "password_not_set", "email": email}
    if not verify_password(password, creator.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    access, refresh = _issue(db, creator.id, "creator")
    return {"status": "ok", "access_token": access, "refresh_token": refresh}


def creator_set_password(db: Session, email: str, password: str) -> tuple[str, str]:
    email = _norm(email)
    _require_strong(password)
    creator = db.scalar(select(Creator).where(Creator.email == email))
    if creator is None or creator.password_hash is not None:
        # Only valid for an invited/migrated account that has no password yet.
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
    row = db.scalar(select(RefreshToken).where(RefreshToken.jti == jti))
    if row is None or row.revoked_at is not None:
        # Reuse of an unknown/already-rotated token -> revoke the whole family.
        _revoke_family(db, subject_id, aud)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token reuse detected")
    from app.core.security import _now  # local import to reuse the tz-aware clock
    row.revoked_at = _now()
    db.commit()
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
