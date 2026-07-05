"""Password hashing + JWT (HS256) with realm-scoped audience and rotating refresh."""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import get_settings

_ALGO = "HS256"
_BCRYPT_MAX = 72  # bcrypt hashes at most 72 bytes


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8")[:_BCRYPT_MAX], bcrypt.gensalt()).decode("utf-8")


def verify_password(raw: str, hashed: str) -> bool:
    return bcrypt.checkpw(raw.encode("utf-8")[:_BCRYPT_MAX], hashed.encode("utf-8"))


def hash_token(token: str) -> str:
    """Refresh tokens are stored as a sha256 hash, never in the clear."""
    return hashlib.sha256(token.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(sub: str, aud: str) -> str:
    s = get_settings()
    now = _now()
    return jwt.encode(
        {"sub": str(sub), "aud": aud, "type": "access", "jti": str(uuid.uuid4()),
         "iat": now, "exp": now + timedelta(minutes=s.jwt_access_ttl_min)},
        s.jwt_secret, algorithm=_ALGO,
    )


def create_impersonation_token(client_id: str, admin_id: str, ttl_minutes: int = 15) -> str:
    """Short-lived client-audience access token minted for an admin's 'View as
    Client' — `imp_by` is carried for audit only; get_current_client's
    validation (aud/type/exp/sub) doesn't look at it, so this is a normal
    client access token in every way except how short it lives."""
    s = get_settings()
    now = _now()
    return jwt.encode(
        {"sub": client_id, "aud": "client", "type": "access", "jti": str(uuid.uuid4()),
         "imp_by": admin_id, "iat": now, "exp": now + timedelta(minutes=ttl_minutes)},
        s.jwt_secret, algorithm=_ALGO,
    )


def create_refresh_token(sub: str, aud: str) -> tuple[str, str, datetime]:
    """Returns (token, jti, expires_at)."""
    s = get_settings()
    now = _now()
    jti = str(uuid.uuid4())
    exp = now + timedelta(days=s.jwt_refresh_ttl_days)
    token = jwt.encode(
        {"sub": str(sub), "aud": aud, "type": "refresh", "jti": jti, "iat": now, "exp": exp},
        s.jwt_secret, algorithm=_ALGO,
    )
    return token, jti, exp


def decode_token(token: str, aud: str) -> dict:
    """Raises jwt.PyJWTError on any failure (bad sig, expired, wrong audience)."""
    return jwt.decode(token, get_settings().jwt_secret, algorithms=[_ALGO], audience=aud)
