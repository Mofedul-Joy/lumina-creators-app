"""Creator auth: signup, password login (+ set-password fallback), check-email, refresh, me."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_creator
from app.db.session import get_db
from app.models import Creator
from app.schemas.auth import (
    CheckEmailOut,
    CreatorLoginOut,
    LoginIn,
    MeOut,
    RefreshIn,
    SetPasswordIn,
    SignupIn,
    TokenOut,
)
from app.services import auth as svc

router = APIRouter(prefix="/auth", tags=["creator-auth"])


@router.post("/signup", response_model=TokenOut)
def signup(body: SignupIn, db: Session = Depends(get_db)):
    access, refresh = svc.creator_signup(db, body.email, body.password)
    return TokenOut(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=CreatorLoginOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    return CreatorLoginOut(**svc.creator_login(db, body.email, body.password))


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
