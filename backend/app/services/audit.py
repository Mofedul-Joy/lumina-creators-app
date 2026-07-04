"""Write an audit_log row for an admin action with real consequences
(verify/reject, payouts, suspend/reactivate, campaign lifecycle). The table
existed but nothing ever wrote to it — no accountability trail for who did
what. Call this in the same transaction as the action it's recording; it
flushes but does not commit, so it rolls back together with the caller if
something later in the same request fails."""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models import AuditLog


def log(
    db: Session,
    *,
    actor_admin_id: Optional[uuid.UUID],
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    **metadata,
) -> None:
    db.add(AuditLog(
        actor_admin_id=actor_admin_id, action=action, entity_type=entity_type,
        entity_id=entity_id, metadata_=metadata,
    ))
    db.flush()
