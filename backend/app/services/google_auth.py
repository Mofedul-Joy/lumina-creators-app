"""Google ID-token verification for sign-in endpoints."""
from __future__ import annotations

import jwt
from fastapi import HTTPException, status

from app.core.config import get_settings

_jwks_client = jwt.PyJWKClient("https://www.googleapis.com/oauth2/v3/certs")


def verify_google_id_token(credential: str) -> dict:
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Google sign-in is not configured",
        )
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(credential).key
        claims = jwt.decode(
            credential,
            signing_key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            issuer=["https://accounts.google.com", "accounts.google.com"],
        )
    except Exception as exc:  # noqa: BLE001 - normalize all verifier failures
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google token") from exc

    if not claims.get("email") or claims.get("email_verified") is not True:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google token")

    return {
        "email": claims.get("email"),
        "email_verified": claims.get("email_verified"),
        "sub": claims.get("sub"),
        "name": claims.get("name"),
        "picture": claims.get("picture"),
    }
