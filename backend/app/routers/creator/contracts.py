"""Creator-facing Campaign Participation Agreements: view + electronically sign."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_creator
from app.db.session import get_db
from app.models import Campaign, Creator
from app.services import contracts as svc

router = APIRouter(prefix="/contracts", tags=["creator-contracts"])


class ContractSummary(BaseModel):
    document_id: str
    campaign_name: str
    company_name: str
    status: str
    created_at: datetime
    accepted_at: Optional[datetime]


class ContractDetail(BaseModel):
    document_id: str
    title: str
    subtitle: str
    company_name: str
    campaign_name: str
    body: str
    status: str
    accepted_at: Optional[datetime]
    accepted_name: Optional[str]


class AcceptIn(BaseModel):
    name: str


def _detail(db: Session, row) -> ContractDetail:
    c = db.get(Campaign, row.campaign_id)
    return ContractDetail(
        document_id=row.document_id, title=row.title, subtitle=row.subtitle,
        company_name=row.company_name, campaign_name=c.name if c else "",
        body=row.rendered_body, status=row.status,
        accepted_at=row.accepted_at, accepted_name=row.accepted_name,
    )


@router.get("", response_model=List[ContractSummary])
def list_my_contracts(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    out = []
    for r in svc.list_mine(db, current.id):
        c = db.get(Campaign, r.campaign_id)
        out.append(ContractSummary(
            document_id=r.document_id, campaign_name=c.name if c else "",
            company_name=r.company_name, status=r.status,
            created_at=r.created_at, accepted_at=r.accepted_at,
        ))
    return out


@router.get("/{document_id}", response_model=ContractDetail)
def get_contract(document_id: str, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    return _detail(db, svc.get_for_creator(db, document_id, current.id))


@router.post("/{document_id}/accept", response_model=ContractDetail)
def accept_contract(document_id: str, body: AcceptIn, request: Request,
                    current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else None)
    return _detail(db, svc.accept(db, document_id, current.id, body.name, ip))
