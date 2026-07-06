"""Admin payout schemas."""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

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
