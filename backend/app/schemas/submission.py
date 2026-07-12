"""Submission schemas. Decimal money, Optional/List for 3.9 Pydantic."""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class SubmissionCreateIn(BaseModel):
    campaign_slug: str
    post_url: str


class ProofVideoAttachIn(BaseModel):
    storage_object_id: str


class SubmissionOut(BaseModel):
    id: str
    campaign_id: str
    post_url: str
    platform: str
    views: int
    likes: int
    comments: int
    estimated_amount: Decimal
    payable_amount: Optional[Decimal] = None
    scrape_status: str
    verification_status: str
    verification_note: Optional[str] = None
    revision_mode: Optional[str] = None  # edit|repost when revision_requested
    has_proof_video: bool = False
    thumbnail_url: Optional[str] = None
    claimed: bool = False
    is_paid: bool = False
    created_at: datetime
