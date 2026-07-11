"""Creator-facing notification feed (the top-bar bell).

Push is best-effort by design: a notification is a side effect of some real
action (an invite, a payout), and failing to record one must never roll back or
fail that action. Callers therefore wrap `push` in their own try/except or rely
on the commit boundary they already own.
"""
from __future__ import annotations

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.security import _now
from app.models import Notification

# The bell doesn't paginate — it shows a recent window. Anything older is history
# the creator has already seen scroll past.
FEED_LIMIT = 50


def push(db: Session, creator_id: uuid.UUID, *, kind: str, title: str,
         body: str | None = None, link: str | None = None, commit: bool = True) -> Notification:
    n = Notification(creator_id=creator_id, kind=kind, title=title, body=body, link=link)
    db.add(n)
    if commit:
        db.commit()
        db.refresh(n)
    else:
        db.flush()
    return n


def list_for(db: Session, creator_id: uuid.UUID, limit: int = FEED_LIMIT) -> list[Notification]:
    return list(db.scalars(
        select(Notification)
        .where(Notification.creator_id == creator_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    ).all())


def unread_count(db: Session, creator_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count()).select_from(Notification)
        .where(Notification.creator_id == creator_id, Notification.read_at.is_(None))
    ) or 0


def mark_read(db: Session, creator_id: uuid.UUID, ids: list[uuid.UUID] | None = None) -> int:
    """Mark the given notifications read, or ALL of the creator's unread ones when
    `ids` is None. Scoped to the creator so one creator can't touch another's."""
    stmt = update(Notification).where(
        Notification.creator_id == creator_id, Notification.read_at.is_(None)
    )
    if ids:
        stmt = stmt.where(Notification.id.in_(ids))
    result = db.execute(stmt.values(read_at=_now()))
    db.commit()
    return result.rowcount or 0
