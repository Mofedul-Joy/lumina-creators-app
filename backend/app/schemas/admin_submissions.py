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
    status: str  # computed lifecycle; payout states remain verified-only
    verification_note: Optional[str] = None
    revision_mode: Optional[str] = None  # edit|repost when revision_requested
    proof_url: Optional[str] = None
    embed_broken: bool = False
    post_unavailable: bool = False
    is_suspicious: bool = False
    creator_is_suspicious: bool = False
    thumbnail_url: Optional[str] = None
    claimed: bool = False
    created_at: datetime


class RejectIn(BaseModel):
    note: str


class RevisionIn(BaseModel):
    mode: str          # edit | repost
    note: str = ""     # optional


class SubmissionCounts(BaseModel):
    pending: int = 0
    verified: int = 0
    rejected: int = 0
    revision_requested: int = 0
