"""Admin payout schemas."""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel


class OwedRow(BaseModel):
    creator_id: str
    display_name: Optional[str] = None
    submission_count: int
    amount_owed: Decimal
    payout_method: Optional[str] = None
    payout_address: Optional[str] = None


class PayoutRow(BaseModel):
    id: str
    creator_id: str
    creator_name: Optional[str] = None
    amount: Decimal
    method: str
    status: str
    reference: Optional[str] = None
    campaign_id: Optional[str] = None      # disambiguates same-named campaigns
    campaign_name: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime


class RecordPayoutIn(BaseModel):
    creator_id: uuid.UUID  # validated -> 422 on malformed, not a 500
    method: str  # paypal | solana | whop
    reference: Optional[str] = None  # optional out-of-band transaction ref


class ManualPaymentIn(BaseModel):
    creator_id: uuid.UUID
    amount: Decimal
    method: str
    reference: str = ""


# ── Payouts engine (Feature 4, BUILD_SPEC.md §3.6) ─────────────────────


class WalletOut(BaseModel):
    id: str
    available_balance: Decimal
    pending_balance: Decimal
    currency: str


class WalletTransactionOut(BaseModel):
    id: str
    kind: str
    amount: Decimal
    reference: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime
    payout_id: Optional[str] = None


class AddFundsIn(BaseModel):
    amount: Decimal
    reference: Optional[str] = None
    note: Optional[str] = None


class OwedBreakdown(BaseModel):
    fixed: Decimal = Decimal("0")
    cpm: Decimal = Decimal("0")
    per_post: Decimal = Decimal("0")
    milestones: Decimal = Decimal("0")


class OwedRowV2(BaseModel):
    creator_id: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    amount_owed: Decimal
    start_date: Optional[datetime] = None
    due_date: Optional[date] = None
    program_name: Optional[str] = None
    campaign_id: Optional[str] = None
    unpaid_posts: int = 0
    total_views: int = 0
    total_earnings_to_date: Decimal = Decimal("0")
    payout_method: Optional[str] = None
    payout_address: Optional[str] = None
    breakdown: OwedBreakdown


class PayAllIn(BaseModel):
    creator_ids: Optional[List[str]] = None


class PayAllOut(BaseModel):
    paid_count: int
    total_amount: Decimal
    payouts: List[PayoutRow]


class ForecastRow(BaseModel):
    campaign_id: str
    campaign_name: str
    projected_amount: Decimal
    active_creators: int
    total_views: int
    avg_daily_burn: Decimal
    days_remaining: Optional[int] = None


class LedgerRow(WalletTransactionOut):
    balance_after: Decimal
