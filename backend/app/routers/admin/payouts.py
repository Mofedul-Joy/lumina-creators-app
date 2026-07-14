"""Admin payouts: outstanding balances, history, record a payout. Admin-only."""
from __future__ import annotations

import csv
import io
import uuid
from datetime import date, datetime, time, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models import Admin, Payout
from app.schemas.payouts import (
    AddFundsIn,
    ForecastRow,
    LedgerRow,
    ManualPaymentIn,
    OwedRow,
    OwedRowV2,
    PayAllIn,
    PayAllOut,
    PayoutRow,
    RecordPayoutIn,
    WalletOut,
)
from app.services import payouts as svc
from app.services.csv_export import sanitize_cell
from app.services import payouts_v2 as svc2

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
    p = svc.record_payout(db, admin.id, body.creator_id, body.method, body.reference or "")
    return _payout_row(p, None)


@router.post("/manual", response_model=PayoutRow)
def manual(body: ManualPaymentIn, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Log a payment made outside the app (a receipt, per the Clippers flow)."""
    if body.method not in _METHODS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid payout method")
    p = svc.log_manual_payment(db, admin.id, body.creator_id, body.amount, body.method, body.reference)
    return _payout_row(p, None)


# ── Payouts engine (Feature 4, BUILD_SPEC.md §3.6) ─────────────────────


@router.get("/owed-v2", response_model=list[OwedRowV2])
def owed_v2(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Auto-calc'd owed per (creator, campaign) using payment_type + bonus
    milestones. The legacy /owed (per-submission verified-earnings) stays
    intact above for back compat."""
    return [OwedRowV2(**{k: v for k, v in r.items() if not k.startswith("_")}) for r in svc2.compute_owed_all(db)]


@router.get("/wallet", response_model=WalletOut)
def wallet(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    w = svc2.wallet_get(db)
    return WalletOut(id=str(w.id), available_balance=w.available_balance,
                     pending_balance=w.pending_balance, currency=w.currency)


@router.post("/wallet/add-funds", response_model=WalletOut)
def wallet_add_funds(body: AddFundsIn, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    """Mock top-up — no real Whop/Stripe integration, just increments balance."""
    w = svc2.wallet_add_funds(db, admin.id, body.amount, body.reference, body.note)
    return WalletOut(id=str(w.id), available_balance=w.available_balance,
                     pending_balance=w.pending_balance, currency=w.currency)


@router.get("/ledger", response_model=list[LedgerRow])
def ledger(limit: int = 100, offset: int = 0, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return [LedgerRow(**row) for row in svc2.wallet_ledger(db, limit=limit, offset=offset)]


@router.post("/pay-all", response_model=PayAllOut)
def pay_all(body: PayAllIn, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    result = svc2.pay_all(db, admin.id, creator_ids=body.creator_ids)
    return PayAllOut(
        paid_count=result["paid_count"],
        total_amount=result["total_amount"],
        payouts=[_payout_row(p, None) for p in result["payouts"]],
    )


class PayOneIn(BaseModel):
    reference: Optional[str] = None


@router.post("/pay-one/{creator_id}", response_model=PayoutRow)
def pay_one(creator_id: uuid.UUID, body: PayOneIn | None = None,
            admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    p = svc2.pay_one(db, admin.id, creator_id, reference=(body.reference if body else None))
    return _payout_row(p, None)


@router.get("/forecast", response_model=list[ForecastRow])
def forecast(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return [ForecastRow(**row) for row in svc2.forecast_all(db)]


def _date_range(from_: Optional[date], to: Optional[date]):
    """Inclusive [start-of-from, end-of-to] as UTC datetimes (payout.created_at
    is tz-aware)."""
    df = datetime.combine(from_, time.min, tzinfo=timezone.utc) if from_ else None
    dt = datetime.combine(to, time.max, tzinfo=timezone.utc) if to else None
    return df, dt


@router.get("/spending-summary")
def spending_summary(
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None, alias="to"),
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Total spend + payout count in a date range — Agency Spending Report preview."""
    df, dt = _date_range(from_, to)
    s = svc2.spending_summary(db, df, dt)
    return {"total": s["total"], "count": s["count"],
            "from": from_.isoformat() if from_ else None,
            "to": to.isoformat() if to else None}


@router.get("/reports.csv")
def reports_csv(
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = Query(None, alias="to"),
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    df, dt = _date_range(from_, to)
    rows = list(svc2.payout_report_rows(db, date_from=df, date_to=dt))

    def _gen():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["creator", "amount", "campaign", "paid_at", "method", "external_ref"])
        yield buf.getvalue()
        buf.seek(0); buf.truncate(0)
        for r in rows:
            writer.writerow([sanitize_cell(c) for c in [r["creator"], r["amount"], r["campaign"], r["paid_at"], r["method"], r["external_ref"]]])
            yield buf.getvalue()
            buf.seek(0); buf.truncate(0)

    return StreamingResponse(
        _gen(), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=payout_reports.csv"},
    )
