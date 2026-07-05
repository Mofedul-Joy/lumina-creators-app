"""Admin payouts: outstanding balances, history, record a payout. Admin-only."""
from __future__ import annotations


from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models import Admin, Payout
from app.schemas.payouts import ManualPaymentIn, OwedRow, PayoutRow, RecordPayoutIn
from app.services import payouts as svc

router = APIRouter(prefix="/payouts", tags=["admin-payouts"])

_METHODS = {"paypal", "solana", "whop"}


def _payout_row(p: Payout, name) -> PayoutRow:
    return PayoutRow(id=str(p.id), creator_id=str(p.creator_id), creator_name=name,
                     amount=p.amount, method=p.method, status=p.status,
                     reference=p.external_ref, paid_at=p.paid_at, created_at=p.created_at)


@router.get("/owed", response_model=list[OwedRow])
def owed(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return [
        OwedRow(creator_id=str(cid), display_name=name, submission_count=n, amount_owed=amount,
               payout_method=method, payout_address=address)
        for cid, name, n, amount, method, address in svc.amounts_owed(db)
    ]


@router.get("", response_model=list[PayoutRow])
def history(limit: int = 50, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return [_payout_row(p, name) for p, name in svc.list_payouts(db, limit=limit)]


@router.post("", response_model=PayoutRow)
def record(body: RecordPayoutIn, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    if body.method not in _METHODS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid payout method")
    p = svc.record_payout(db, admin.id, body.creator_id, body.method)
    return _payout_row(p, None)


@router.post("/manual", response_model=PayoutRow)
def manual(body: ManualPaymentIn, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Log a payment made outside the app (a receipt, per the Clippers flow)."""
    if body.method not in _METHODS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid payout method")
    p = svc.log_manual_payment(db, admin.id, body.creator_id, body.amount, body.method, body.reference)
    return _payout_row(p, None)
