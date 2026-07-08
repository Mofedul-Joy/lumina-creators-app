"""Public, unauthenticated client report (Feature 6, BUILD_SPEC.md §3.7).

STRICTLY PII-free: only creator display_name + avatar_url are surfaced (no
email, phone, address, city/country, or date of birth). This mirrors the
aggregation logic in app/routers/client/campaigns.py but is reachable with
just a high-entropy share_token — no auth — so every field here must be safe
to hand to an outside client with no login.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class PublicReportSubmissionRow(BaseModel):
    id: str
    creator_display_name: Optional[str] = None
    creator_avatar_url: Optional[str] = None
    platform: str
    post_url: str
    thumbnail_url: Optional[str] = None
    views: int
    likes: int
    comments: int
    submitted_at: datetime


class PublicReportOut(BaseModel):
    campaign_id: str
    slug: str
    name: str
    brand_name: Optional[str] = None
    banner_url: Optional[str] = None
    status: str
    mode: str
    published_at: Optional[datetime] = None
    total_views: int
    total_likes: int
    total_comments: int
    engagement_rate: float  # (likes + comments) / max(views, 1)
    submission_count: int
    creator_count: int
    submissions: List[PublicReportSubmissionRow] = []
