"""Admin submission-review schemas."""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class AdminSubmissionRow(BaseModel):
    id: str
    campaign_id: str
    campaign_name: str
    campaign_mode: str
    creator_id: str
    creator_name: Optional[str] = None
    platform: str
    post_url: str
    views: int
    likes: int
    comments: int
    estimated_amount: Decimal
    verification_status: str
    scrape_status: str
    status: str  # computed lifecycle: awaiting_stats|proof_uploaded|stats_verified|paid|rejected
    verification_note: Optional[str] = None
    proof_url: Optional[str] = None
    embed_broken: bool = False
    post_unavailable: bool = False
    thumbnail_url: Optional[str] = None
    created_at: datetime


class RejectIn(BaseModel):
    note: str


class SubmissionCounts(BaseModel):
    pending: int = 0
    verified: int = 0
    rejected: int = 0
