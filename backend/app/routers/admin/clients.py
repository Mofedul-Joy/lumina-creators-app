"""Admin: list client (brand) accounts + per-client submission rollups. Powers
the campaign builder's client picker and the Clients admin page. Creation stays
manual/seeded for now.

The per-client campaign roster and "view as client" impersonation endpoints that
used to live here served the dashboard's "Client submissions" panel; both are
parked on the `client-submission-on-admin-dashboard` branch."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models import Admin, Campaign, Client, Submission

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
        .outerjoin(
            Submission,
            and_(
                Submission.campaign_id == Campaign.id,
                Submission.verification_status == "verified",
            ),
        )
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


# The per-client campaign roster and the "View as client" impersonation endpoint
# both existed only to serve the admin dashboard's "Client submissions" panel.
# That panel is parked, unmerged, on the `client-submission-on-admin-dashboard`
# branch; the dashboard now works per-campaign instead. Restore both from that
# branch if the per-client view is ever brought back.
