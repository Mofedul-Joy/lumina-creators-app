"""Auth dependencies — the security boundary. One per realm; aud claim keeps them separate."""
from __future__ import annotations

import uuid

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models import Admin, Client, Creator

_bearer = HTTPBearer(auto_error=True)


def _make_dep(aud: str, model):
    def dep(
        creds: HTTPAuthorizationCredentials = Depends(_bearer),
        db: Session = Depends(get_db),
    ):
        try:
            payload = decode_token(creds.credentials, aud)
        except jwt.PyJWTError:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
        if payload.get("type") != "access":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Wrong token type")
        try:
            obj = db.get(model, uuid.UUID(payload["sub"]))
        except (ValueError, KeyError):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token subject")
        if obj is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account not found")
        return obj

    return dep


get_current_creator = _make_dep("creator", Creator)
get_current_admin = _make_dep("admin", Admin)
get_current_client = _make_dep("client", Client)
