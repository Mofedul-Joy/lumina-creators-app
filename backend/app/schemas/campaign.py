"""Campaign schemas. Money as Decimal (never float). Optional/List for 3.9 Pydantic."""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel


class BonusMilestoneIn(BaseModel):
    """Step 3 of the campaign wizard — repeatable views-threshold bonus row."""
    views_threshold: int
    bonus_amount: Decimal
    description: Optional[str] = None
    sort_order: int = 0


class BonusMilestoneOut(BaseModel):
    id: str
    views_threshold: int
    bonus_amount: Decimal
    description: Optional[str] = None
    sort_order: int = 0


class CampaignCreateIn(BaseModel):
    name: str
    mode: str  # create_new | copy_paste
    cpm_rate: Decimal
    budget: Decimal
    description: Optional[str] = None
    max_payout_per_creator: Optional[Decimal] = None
    min_payout_amount: Optional[Decimal] = None
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

    # ── 6-step campaign builder wizard (Feature 3) ──────────────────────────────
    job_type: Optional[str] = None
    creator_type: Optional[str] = None
    payment_type: Optional[str] = None
    fixed_amount: Optional[Decimal] = None
    weekly_hours_needed: Optional[int] = None
    hourly_rate: Optional[Decimal] = None
    required_hours: Optional[int] = None
    per_post_amount: Optional[Decimal] = None
    example_videos: List[str] = []
    age_requirement: Optional[str] = None
    platform_focus: List[str] = []
    content_type: Optional[str] = None
    posting_frequency: Optional[str] = None
    video_length: Optional[str] = None
    account_type: Optional[str] = None
    is_app: bool = False
    physical_product: bool = False
    banner_url: Optional[str] = None
    # ---- campaign creation flow (0024) ----
    campaign_kind: Optional[str] = None        # high_volume_ugc|influencer|paid_ads|campaign_manager|analytics_only
    experience_level: Optional[str] = None     # essentials|advanced
    no_platform_tracking: Optional[bool] = None
    payment_schedule: Optional[str] = None     # every_7_days|every_14_days|every_30_days
    payment_cycle_trigger: Optional[str] = None  # post_delivery|schedule
    pro_rata: Optional[bool] = None
    min_views: Optional[int] = None
    posts_per_payment: Optional[int] = None
    bonus_milestones: List[BonusMilestoneIn] = []


class CampaignUpdateIn(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cpm_rate: Optional[Decimal] = None
    budget: Optional[Decimal] = None
    max_payout_per_creator: Optional[Decimal] = None
    min_payout_amount: Optional[Decimal] = None
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

    # ── 6-step campaign builder wizard (Feature 3) ──────────────────────────────
    job_type: Optional[str] = None
    creator_type: Optional[str] = None
    payment_type: Optional[str] = None
    fixed_amount: Optional[Decimal] = None
    weekly_hours_needed: Optional[int] = None
    hourly_rate: Optional[Decimal] = None
    required_hours: Optional[int] = None
    per_post_amount: Optional[Decimal] = None
    example_videos: Optional[List[str]] = None
    age_requirement: Optional[str] = None
    platform_focus: Optional[List[str]] = None
    content_type: Optional[str] = None
    posting_frequency: Optional[str] = None
    video_length: Optional[str] = None
    account_type: Optional[str] = None
    is_app: Optional[bool] = None
    physical_product: Optional[bool] = None
    banner_url: Optional[str] = None
    # ---- campaign creation flow (0024) ----
    campaign_kind: Optional[str] = None        # high_volume_ugc|influencer|paid_ads|campaign_manager|analytics_only
    experience_level: Optional[str] = None     # essentials|advanced
    no_platform_tracking: Optional[bool] = None
    payment_schedule: Optional[str] = None     # every_7_days|every_14_days|every_30_days
    payment_cycle_trigger: Optional[str] = None  # post_delivery|schedule
    pro_rata: Optional[bool] = None
    min_views: Optional[int] = None
    posts_per_payment: Optional[int] = None
    bonus_milestones: Optional[List[BonusMilestoneIn]] = None


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
    min_payout_amount: Optional[Decimal] = None
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

    # ── 6-step campaign builder wizard (Feature 3) ──────────────────────────────
    job_type: Optional[str] = None
    creator_type: Optional[str] = None
    payment_type: Optional[str] = None
    fixed_amount: Optional[Decimal] = None
    weekly_hours_needed: Optional[int] = None
    hourly_rate: Optional[Decimal] = None
    required_hours: Optional[int] = None
    per_post_amount: Optional[Decimal] = None
    example_videos: List[str] = []
    age_requirement: Optional[str] = None
    platform_focus: List[str] = []
    content_type: Optional[str] = None
    posting_frequency: Optional[str] = None
    video_length: Optional[str] = None
    account_type: Optional[str] = None
    is_app: bool = False
    physical_product: bool = False
    banner_url: Optional[str] = None
    campaign_kind: str = "high_volume_ugc"
    experience_level: str = "essentials"
    no_platform_tracking: bool = False
    payment_schedule: Optional[str] = None
    payment_cycle_trigger: str = "post_delivery"
    pro_rata: bool = True
    min_views: Optional[int] = None
    posts_per_payment: int = 1
    bonus_milestones: List[BonusMilestoneOut] = []

    # ── Client read-only report + share_token (Feature 6) ──
    share_token: Optional[str] = None
    share_enabled: bool = False


class ShareTokenOut(BaseModel):
    """Returned by the admin enable/rotate share-token endpoints."""
    share_token: str
    share_enabled: bool
    share_url: str


class ExampleVideoOut(BaseModel):
    url: str
    platform: Optional[str] = None
    thumbnail_url: Optional[str] = None


class ExampleVideoAdminOut(BaseModel):
    id: str
    url: str
    platform: Optional[str] = None
    thumbnail_url: Optional[str] = None
    source: str = "admin"


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
    approved: bool = False   # admin has accepted the creator into the campaign

    # ── 6-step campaign builder wizard (Feature 3) — surfaced natively (Feature 5) ──
    payment_type: Optional[str] = None
    fixed_amount: Optional[Decimal] = None
    weekly_hours_needed: Optional[int] = None
    hourly_rate: Optional[Decimal] = None
    required_hours: Optional[int] = None
    per_post_amount: Optional[Decimal] = None
    example_videos: List[str] = []
    examples: List[ExampleVideoOut] = []   # structured: url + platform + cached thumbnail
    age_requirement: Optional[str] = None
    platform_focus: List[str] = []
    content_type: Optional[str] = None
    posting_frequency: Optional[str] = None
    video_length: Optional[str] = None
    account_type: Optional[str] = None
    is_app: bool = False
    physical_product: bool = False
    banner_url: Optional[str] = None
    bonus_milestones: List[BonusMilestoneOut] = []
    job_type: Optional[str] = None
    creator_type: Optional[str] = None


class ParticipationOut(BaseModel):
    id: str
    campaign_id: str
    status: str


class MyCampaignOut(BaseModel):
    """A campaign the creator has applied to / joined, with their application
    status — powers the 'My Campaigns' applications list."""
    participation_id: str
    campaign_id: str
    slug: str
    name: str
    brand_name: Optional[str] = None
    mode: str
    cpm_rate: Decimal
    status: str
    submission_count: int = 0
