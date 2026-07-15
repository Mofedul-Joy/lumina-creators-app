"""Admin: list client (brand) accounts + per-client submission rollups, and
mint a short-lived "view as client" impersonation token. Powers the campaign
builder's client picker AND the admin dashboard's per-client submissions panel.
Creation stays manual/seeded for now."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.core.security import create_impersonation_token
from app.db.session import get_db
from app.models import Admin, Campaign, Client, Submission
from app.services import audit

router = APIRouter(prefix="/clients", tags=["admin-clients"])


class ClientListItem(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    status: str
    campaign_count: int = 0
    submission_count: int = 0
    total_views: int = 0
    total_interactions: int = 0


def _client_rollups(db: Session) -> dict[uuid.UUID, dict]:
    """Per-client aggregate across all of a client's campaigns' submissions."""
    rows = db.execute(
        select(
            Campaign.client_id,
            func.count(func.distinct(Campaign.id)),
            func.count(Submission.id),
            func.coalesce(func.sum(Submission.views), 0),
            func.coalesce(func.sum(Submission.likes + Submission.comments), 0),
        )
        .select_from(Campaign)
        .outerjoin(Submission, Submission.campaign_id == Campaign.id)
        .where(Campaign.client_id.isnot(None))
        .group_by(Campaign.client_id)
    ).all()
    return {
        r[0]: {
            "campaign_count": r[1] or 0,
            "submission_count": r[2] or 0,
            "total_views": int(r[3] or 0),
            "total_interactions": int(r[4] or 0),
        }
        for r in rows
    }


@router.get("", response_model=list[ClientListItem])
def list_clients(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    rows = db.scalars(select(Client).order_by(Client.created_at.desc())).all()
    stats = _client_rollups(db)
    return [
        ClientListItem(
            id=str(c.id), email=c.email, name=c.name, status=c.status,
            **stats.get(c.id, {}),
        )
        for c in rows
    ]


@router.post("/{client_id}/impersonate")
def impersonate(client_id: uuid.UUID, admin: Admin = Depends(get_current_admin),
                db: Session = Depends(get_db)):
    """Mint a 15-minute client-scoped token so an admin can open the brand's own
    dashboard exactly as that client sees it ("View as client"). Audit-logged
    since it's a real (if short-lived) session as someone else's account."""
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Client not found")
    token = create_impersonation_token(str(client_id), str(admin.id))
    audit.log(db, actor_admin_id=admin.id, action="client.impersonate",
              entity_type="client", entity_id=client_id)
    db.commit()
    return {"access_token": token}
