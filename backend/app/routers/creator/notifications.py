"""Creator notification feed — powers the top-bar bell drawer."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_creator
from app.db.session import get_db
from app.models import Creator
from app.services import notifications as svc

router = APIRouter(prefix="/notifications", tags=["creator-notifications"])


class NotificationOut(BaseModel):
    id: str
    kind: str
    title: str
    body: Optional[str]
    link: Optional[str]
    read: bool
    created_at: datetime


class UnreadCountOut(BaseModel):
    unread: int


class MarkReadIn(BaseModel):
    ids: Optional[List[uuid.UUID]] = None  # None → mark all read


def _out(n) -> NotificationOut:
    return NotificationOut(
        id=str(n.id), kind=n.kind, title=n.title, body=n.body, link=n.link,
        read=n.read_at is not None, created_at=n.created_at,
    )


@router.get("", response_model=list[NotificationOut])
def list_notifications(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    return [_out(n) for n in svc.list_for(db, current.id)]


@router.get("/unread-count", response_model=UnreadCountOut)
def unread_count(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    return UnreadCountOut(unread=svc.unread_count(db, current.id))


@router.post("/read", response_model=UnreadCountOut)
def mark_read(body: MarkReadIn, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    svc.mark_read(db, current.id, body.ids)
    return UnreadCountOut(unread=svc.unread_count(db, current.id))
