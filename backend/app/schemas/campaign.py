"""Campaign schemas. Money as Decimal (never float). Optional/List for 3.9 Pydantic."""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel


class CampaignCreateIn(BaseModel):
    name: str
    mode: str  # create_new | copy_paste
    cpm_rate: Decimal
    budget: Decimal
    description: Optional[str] = None
    max_payout_per_creator: Optional[Decimal] = None
    eligible_view_pct: Decimal = Decimal("100")
    min_retention_days: int = 30
    platforms: List[str] = []
    geo_countries: List[str] = []
    brief_script: Optional[str] = None          # create_new
    content_drive_url: Optional[str] = None      # copy_paste
    caption_rules: Optional[str] = None
    required_mentions: List[str] = []
    example_captions: List[str] = []
    requirements_url: Optional[str] = None
    brand_name: Optional[str] = None
    brand_logo_url: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    client_id: Optional[str] = None


class CampaignUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cpm_rate: Optional[Decimal] = None
    budget: Optional[Decimal] = None
    max_payout_per_creator: Optional[Decimal] = None
    eligible_view_pct: Optional[Decimal] = None
    min_retention_days: Optional[int] = None
    platforms: Optional[List[str]] = None
    geo_countries: Optional[List[str]] = None
    brief_script: Optional[str] = None
    content_drive_url: Optional[str] = None
    caption_rules: Optional[str] = None
    required_mentions: Optional[List[str]] = None
    example_captions: Optional[List[str]] = None
    requirements_url: Optional[str] = None
    brand_name: Optional[str] = None
    brand_logo_url: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    client_id: Optional[str] = None


class CampaignOut(BaseModel):
    """Full admin view."""
    id: str
    slug: str
    name: str
    description: Optional[str] = None
    mode: str
    status: str
    cpm_rate: Decimal
    budget: Decimal
    spent_amount: Decimal
    max_payout_per_creator: Optional[Decimal] = None
    eligible_view_pct: Decimal
    min_retention_days: int
    platforms: List[str] = []
    geo_countries: List[str] = []
    brief_script: Optional[str] = None
    content_drive_url: Optional[str] = None
    caption_rules: Optional[str] = None
    required_mentions: List[str] = []
    example_captions: List[str] = []
    requirements_url: Optional[str] = None
    brand_name: Optional[str] = None
    brand_logo_url: Optional[str] = None
    client_id: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    published_at: Optional[datetime] = None


class CampaignPublicOut(BaseModel):
    """Creator-facing browse/detail view — no spent_amount/client/created_by."""
    id: str
    slug: str
    name: str
    description: Optional[str] = None
    mode: str
    cpm_rate: Decimal
    budget: Decimal
    platforms: List[str] = []
    min_retention_days: int
    brief_script: Optional[str] = None
    content_drive_url: Optional[str] = None
    caption_rules: Optional[str] = None
    required_mentions: List[str] = []
    example_captions: List[str] = []
    requirements_url: Optional[str] = None
    brand_name: Optional[str] = None
    brand_logo_url: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    joined: bool = False


class ParticipationOut(BaseModel):
    id: str
    campaign_id: str
    status: str
