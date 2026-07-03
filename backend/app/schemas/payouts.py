"""Admin payout schemas."""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class OwedRow(BaseModel):
    creator_id: str
    display_name: Optional[str] = None
    submission_count: int
    amount_owed: Decimal


class PayoutRow(BaseModel):
    id: str
    creator_id: str
    creator_name: Optional[str] = None
    amount: Decimal
    method: str
    status: str
    paid_at: Optional[datetime] = None
    created_at: datetime


class RecordPayoutIn(BaseModel):
    creator_id: str
    method: str  # paypal | solana | whop
