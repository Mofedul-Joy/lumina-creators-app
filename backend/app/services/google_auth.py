"""Google sign-in verification for the auth endpoints.

Two entry points:
- verify_google_id_token: validates a Google ID token (JWKS/RS256) — used by the
  GIS One Tap credential flow.
- exchange_google_code: the custom-button auth-code (popup) flow — trades the
  one-time code for tokens using the client_id + client_secret, then verifies the
  returned id_token. This is the flow the frontend button uses.
"""
from __future__ import annotations

import logging

import httpx
import jwt
from fastapi import HTTPException, status

from app.core.config import get_settings

logger = logging.getLogger("app.google_auth")
_jwks_client = jwt.PyJWKClient("https://www.googleapis.com/oauth2/v3/certs")


def exchange_google_code(code: str) -> dict:
    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google sign-in is not configured")
    try:
        resp = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                # 'postmessage' is the redirect_uri for the JS popup code flow.
                "redirect_uri": "postmessage",
                "grant_type": "authorization_code",
            },
            timeout=15,
        )
    except Exception as exc:  # noqa: BLE001 - network/verifier failures → 401
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not verify Google sign-in") from exc
    if resp.status_code != 200:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google authorization code")
    id_token = resp.json().get("id_token")
    if not id_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google authorization code")
    return verify_google_id_token(id_token)


def verify_google_id_token(credential: str) -> dict:
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Google sign-in is not configured",
        )
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(credential).key
        # Verify signature + audience + expiry (with small clock leeway). Issuer is
        # checked manually below so a str-vs-list mismatch can't reject a valid token.
        claims = jwt.decode(
            credential,
            signing_key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            leeway=30,
            options={"verify_iss": False},
        )
    except Exception as exc:  # noqa: BLE001 - normalize all verifier failures
        logger.warning("google id_token decode failed: %r", exc)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google token") from exc

    iss = claims.get("iss")
    # email_verified may arrive as a bool (True) or a string ("true").
    email_ok = str(claims.get("email_verified")).lower() == "true"
    if iss not in ("https://accounts.google.com", "accounts.google.com") or not claims.get("email") or not email_ok:
        logger.warning("google id_token claim check failed: iss=%r email=%r email_verified=%r",
                       iss, claims.get("email"), claims.get("email_verified"))
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Google token")

    return {
        "email": claims.get("email"),
        "email_verified": claims.get("email_verified"),
        "sub": claims.get("sub"),
        "name": claims.get("name"),
        "picture": claims.get("picture"),
    }
