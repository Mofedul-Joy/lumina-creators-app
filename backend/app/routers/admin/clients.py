"""Admin: list client (brand) accounts — powers the campaign builder's
client picker. Creation stays manual/seeded for now."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models import Admin, Client

router = APIRouter(prefix="/clients", tags=["admin-clients"])


class ClientListItem(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    status: str


@router.get("", response_model=list[ClientListItem])
def list_clients(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    rows = db.scalars(select(Client).order_by(Client.created_at.desc())).all()
    return [ClientListItem(id=str(c.id), email=c.email, name=c.name, status=c.status) for c in rows]
