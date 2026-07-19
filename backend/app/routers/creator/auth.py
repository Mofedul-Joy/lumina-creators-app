"""Creator auth: signup, password login (+ set-password fallback), check-email, refresh, me."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core import ratelimit
from app.core.deps import get_current_creator
from app.db.session import get_db
from app.models import Creator
from app.schemas.auth import (
    CheckEmailOut,
    CreatorLoginOut,
    GoogleAuthIn,
    LoginIn,
    MeOut,
    RefreshIn,
    ResendCodeIn,
    ResendOut,
    SetPasswordIn,
    SignupIn,
    SignupOut,
    TokenOut,
    VerifyEmailIn,
)
from app.services import auth as svc

router = APIRouter(prefix="/auth", tags=["creator-auth"])


@router.post("/signup", response_model=SignupOut)
def signup(body: SignupIn, db: Session = Depends(get_db)):
    return SignupOut(**svc.creator_signup(db, body.email, body.password, invite=body.invite))


@router.post("/verify-email", response_model=TokenOut)
def verify_email(body: VerifyEmailIn, db: Session = Depends(get_db)):
    access, refresh = svc.verify_email_code(db, body.email, body.code)
    return TokenOut(access_token=access, refresh_token=refresh)


@router.post("/resend-code", response_model=ResendOut)
def resend_code(body: ResendCodeIn, db: Session = Depends(get_db)):
    return ResendOut(**svc.resend_email_code(db, body.email))


@router.post("/login", response_model=CreatorLoginOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    identifiers = [body.email, ratelimit.client_ip(request)]
    ratelimit.require_allowed("creator", identifiers)
    try:
        result = svc.creator_login(db, body.email, body.password)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            ratelimit.record_failure("creator", identifiers)
        raise
    ratelimit.reset("creator", identifiers)
    return CreatorLoginOut(**result)


@router.post("/google", response_model=CreatorLoginOut)
def google(body: GoogleAuthIn, request: Request, db: Session = Depends(get_db)):
    identifiers = [ratelimit.client_ip(request)]
    ratelimit.require_allowed("creator", identifiers)
    try:
        result = svc.creator_google_login(db, body.credential)
    except HTTPException as exc:
        if exc.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN):
            ratelimit.record_failure("creator", identifiers)
        raise
    ratelimit.reset("creator", identifiers)
    return CreatorLoginOut(**result)


@router.post("/set-password", response_model=TokenOut)
def set_password(body: SetPasswordIn, db: Session = Depends(get_db)):
    access, refresh = svc.creator_set_password(db, body.email, body.password)
    return TokenOut(access_token=access, refresh_token=refresh)


@router.get("/check-email", response_model=CheckEmailOut)
def check_email(email: str, db: Session = Depends(get_db)):
    return CheckEmailOut(**svc.creator_check_email(db, email))


@router.post("/refresh", response_model=TokenOut)
def refresh(body: RefreshIn, db: Session = Depends(get_db)):
    access, refresh_token = svc.rotate_refresh(db, body.refresh_token, "creator")
    return TokenOut(access_token=access, refresh_token=refresh_token)


@router.get("/me", response_model=MeOut)
def me(current: Creator = Depends(get_current_creator)):
    return MeOut(id=str(current.id), email=current.email)
