"""Admin user management: staff (admins) + brand (client) accounts, plus a
creator headcount. Clients can be suspended/reactivated. Creating accounts with
passwords stays a seeded/invite flow — not done from the console."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.core.security import hash_password
from app.db.session import get_db
from app.models import Admin, Campaign, Client, Creator

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


class BrandCampaign(BaseModel):
    id: str
    name: str
    status: str
    cpm_rate: Decimal
    budget: Decimal


class BrandDetail(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    status: str
    created_at: datetime
    campaigns: list[BrandCampaign]


class StaffDetail(BaseModel):
    id: str
    email: str
    role: str
    status: str
    created_at: datetime


class CreateUserIn(BaseModel):
    name: Optional[str] = None
    email: str
    password: str
    role: str  # "admin" (read/write all) | "client" (read-only, scoped)
    campaign_ids: list[str] = []  # for client: campaigns they can see


@router.post("/create", response_model=UserRow)
def create_user(body: CreateUserIn, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if len(body.password) < 8:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password must be at least 8 characters")
    if body.role == "admin":
        if db.scalar(select(Admin).where(Admin.email == email)):
            raise HTTPException(status.HTTP_409_CONFLICT, "An admin with this email already exists")
        a = Admin(email=email, password_hash=hash_password(body.password), role="admin", is_active=True)
        db.add(a); db.commit(); db.refresh(a)
        return UserRow(id=str(a.id), email=a.email, role="admin", status="active")
    if body.role == "client":
        if db.scalar(select(Client).where(Client.email == email)):
            raise HTTPException(status.HTTP_409_CONFLICT, "A client with this email already exists")
        c = Client(email=email, name=(body.name or None), password_hash=hash_password(body.password), status="active")
        db.add(c); db.flush()
        # grant read-only access to the chosen campaigns (client sees campaigns linked to them)
        for cid in body.campaign_ids:
            try:
                camp = db.get(Campaign, uuid.UUID(cid))
            except ValueError:
                camp = None
            if camp:
                camp.client_id = c.id
        db.commit(); db.refresh(c)
        return UserRow(id=str(c.id), email=c.email, name=c.name, role="client", status=c.status)
    raise HTTPException(status.HTTP_400_BAD_REQUEST, "Role must be 'admin' or 'client'")


@router.get("/brands/{client_id}", response_model=BrandDetail)
def brand_detail(client_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    c = db.get(Client, client_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Brand not found")
    camps = db.scalars(
        select(Campaign).where(Campaign.client_id == client_id).order_by(Campaign.created_at.desc())
    ).all()
    return BrandDetail(
        id=str(c.id), email=c.email, name=c.name, status=c.status, created_at=c.created_at,
        campaigns=[BrandCampaign(id=str(k.id), name=k.name, status=k.status,
                                 cpm_rate=k.cpm_rate, budget=k.budget) for k in camps],
    )


@router.get("/staff/{admin_id}", response_model=StaffDetail)
def staff_detail(admin_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    a = db.get(Admin, admin_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Staff member not found")
    return StaffDetail(id=str(a.id), email=a.email, role=a.role,
                       status="active" if a.is_active else "suspended", created_at=a.created_at)


@router.post("/clients/{client_id}/suspend", response_model=UserRow)
def suspend_client(client_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return _set_client_status(db, client_id, "suspended")


@router.post("/clients/{client_id}/reactivate", response_model=UserRow)
def reactivate_client(client_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return _set_client_status(db, client_id, "active")
