"""Admin creator invites: email an address and/or share a join link. Admin-only."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models import Admin
from app.services import invites as svc

router = APIRouter(prefix="/invites", tags=["admin-invites"])


class InviteIn(BaseModel):
    # Omit to mint a generic shareable link rather than emailing one address.
    email: Optional[str] = None


class InviteOut(BaseModel):
    id: str
    email: Optional[str] = None
    link: str
    email_sent: bool
    accepted: bool
    created_at: datetime


@router.get("", response_model=List[InviteOut])
def list_invites(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return svc.list_invites(db)


@router.post("", response_model=InviteOut)
def create_invite(body: InviteIn, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return svc.create_invite(db, admin.id, body.email)


@router.delete("/{invite_id}", status_code=204)
def revoke_invite(invite_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    svc.revoke_invite(db, invite_id)
