"""Admin auth: password login, refresh, me. Admins are provisioned, not self-signup."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core import ratelimit
from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models import Admin
from app.schemas.auth import GoogleAuthIn, LoginIn, MeOut, RefreshIn, TokenOut
from app.services import auth as svc

router = APIRouter(prefix="/auth", tags=["admin-auth"])


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    identifiers = [body.email, ratelimit.client_ip(request)]
    ratelimit.require_allowed("admin", identifiers)
    try:
        access, refresh = svc.admin_login(db, body.email, body.password)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            ratelimit.record_failure("admin", identifiers)
        raise
    ratelimit.reset("admin", identifiers)
    return TokenOut(access_token=access, refresh_token=refresh)


@router.post("/google", response_model=TokenOut)
def google(body: GoogleAuthIn, request: Request, db: Session = Depends(get_db)):
    identifiers = [ratelimit.client_ip(request)]
    ratelimit.require_allowed("admin", identifiers)
    try:
        access, refresh = svc.admin_google_login(db, body.code)
    except HTTPException as exc:
        if exc.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN):
            ratelimit.record_failure("admin", identifiers)
        raise
    ratelimit.reset("admin", identifiers)
    return TokenOut(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenOut)
def refresh(body: RefreshIn, db: Session = Depends(get_db)):
    access, refresh_token = svc.rotate_refresh(db, body.refresh_token, "admin")
    return TokenOut(access_token=access, refresh_token=refresh_token)


@router.get("/me", response_model=MeOut)
def me(current: Admin = Depends(get_current_admin)):
    return MeOut(id=str(current.id), email=current.email)
