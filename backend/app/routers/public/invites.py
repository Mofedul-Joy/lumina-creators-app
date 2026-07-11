"""Public invite lookup — lets the signup page validate an invite link and
prefill the invited address. No auth: holding the token IS the credential."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services import invites as svc

router = APIRouter(prefix="/invites", tags=["public-invites"])


class InvitePeekOut(BaseModel):
    email: Optional[str] = None   # None for a generic shareable link
    accepted: bool


@router.get("/{token}", response_model=InvitePeekOut)
def peek_invite(token: str, db: Session = Depends(get_db)):
    return svc.peek(db, token)
