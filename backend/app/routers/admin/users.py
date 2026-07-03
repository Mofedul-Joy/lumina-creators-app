"""Admin user management: staff (admins) + brand (client) accounts, plus a
creator headcount. Clients can be suspended/reactivated. Creating accounts with
passwords stays a seeded/invite flow — not done from the console."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models import Admin, Client, Creator

router = APIRouter(prefix="/users", tags=["admin-users"])


class UserRow(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    role: str
    status: str


class UsersOut(BaseModel):
    admins: list[UserRow]
    clients: list[UserRow]
    creator_count: int
    creator_active: int


@router.get("", response_model=UsersOut)
def list_users(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    admins = db.scalars(select(Admin).order_by(Admin.created_at)).all()
    clients = db.scalars(select(Client).order_by(Client.created_at.desc())).all()
    creator_count = db.execute(select(func.count()).select_from(Creator)).scalar() or 0
    creator_active = db.execute(
        select(func.count()).select_from(Creator).where(Creator.status == "active")
    ).scalar() or 0
    return UsersOut(
        admins=[UserRow(id=str(a.id), email=a.email, role=a.role,
                        status="active" if a.is_active else "suspended") for a in admins],
        clients=[UserRow(id=str(c.id), email=c.email, name=c.name, role="client", status=c.status)
                 for c in clients],
        creator_count=creator_count,
        creator_active=creator_active,
    )


def _set_client_status(db: Session, client_id: uuid.UUID, new_status: str) -> UserRow:
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client not found")
    client.status = new_status
    db.commit()
    db.refresh(client)
    return UserRow(id=str(client.id), email=client.email, name=client.name, role="client", status=client.status)


@router.post("/clients/{client_id}/suspend", response_model=UserRow)
def suspend_client(client_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return _set_client_status(db, client_id, "suspended")


@router.post("/clients/{client_id}/reactivate", response_model=UserRow)
def reactivate_client(client_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return _set_client_status(db, client_id, "active")
