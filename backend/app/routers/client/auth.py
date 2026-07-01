"""Client (brand) auth: password login, refresh, me. Read-only realm; no signup."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_client
from app.db.session import get_db
from app.models import Client
from app.schemas.auth import LoginIn, MeOut, RefreshIn, TokenOut
from app.services import auth as svc

router = APIRouter(prefix="/auth", tags=["client-auth"])


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    access, refresh = svc.client_login(db, body.email, body.password)
    return TokenOut(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenOut)
def refresh(body: RefreshIn, db: Session = Depends(get_db)):
    access, refresh_token = svc.rotate_refresh(db, body.refresh_token, "client")
    return TokenOut(access_token=access, refresh_token=refresh_token)


@router.get("/me", response_model=MeOut)
def me(current: Client = Depends(get_current_client)):
    return MeOut(id=str(current.id), email=current.email)
