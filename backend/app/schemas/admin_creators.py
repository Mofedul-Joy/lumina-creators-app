"""Admin creator-database schemas (list + drill-down). Optional/List for 3.9 Pydantic."""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel


class CreatorListItem(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    gender: Optional[str] = None
    country: Optional[str] = None
    primary_language: Optional[str] = None
    total_followers: int = 0
    platforms: List[str] = []
    completed: bool = False
    is_suspicious: bool = False
    # Feature 2 — SideShift-style rich card enrichments surfaced on list cards.
    rank: Optional[str] = None
    total_views: int = 0
    total_earned: Decimal = Decimal("0")
    # SideShift-parity roster columns: status dot, weekly post activity,
    # connected accounts, campaigns joined/active, joined date.
    status: str = "active"
    accounts_count: int = 0
    campaigns_total: int = 0
    campaigns_active: int = 0
    posts_7d: int = 0
    days_active_7d: int = 0
    created_at: Optional[datetime] = None


class SocialItem(BaseModel):
    platform: str
    handle: str
    profile_url: Optional[str] = None
    follower_count: Optional[int] = None


class PortfolioItemOut(BaseModel):
    id: str
    brand_name: Optional[str] = None
    caption: Optional[str] = None
    platform: Optional[str] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_top_content: bool = False
    views: int = 0
    likes: int = 0


class CreatorDetail(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    ethnicity: Optional[str] = None
    primary_language: Optional[str] = None
    languages: List[str] = []
    country: Optional[str] = None
    city: Optional[str] = None
    completed: bool = False
    is_suspicious: bool = False
    socials: List[SocialItem] = []
    portfolio: List[PortfolioItemOut] = []
    # Payout details the creator saved themselves — surfaced so the admin's
    # "Pay now" modal can show exactly where/how to pay them manually.
    payout_method: Optional[str] = None
    payout_address: Optional[str] = None
    payout_paypal: Optional[str] = None
    payout_solana: Optional[str] = None
    payout_whop: Optional[str] = None


# ── Feature 2: rich creator/applicant detail card (BUILD_SPEC.md §3.1 + §3.9) ──

class RichSocialItem(BaseModel):
    platform: str
    handle: str
    profile_url: Optional[str] = None
    follower_count: Optional[int] = None


class RecentSubmissionItem(BaseModel):
    id: str
    post_url: str
    platform: str
    views: int = 0
    likes: int = 0
    comments: int = 0
    shares: Optional[int] = None
    thumbnail_url: Optional[str] = None
    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None


class ExperienceItem(BaseModel):
    id: str
    title: str
    org: Optional[str] = None
    url: Optional[str] = None
    kind_label: Optional[str] = None
    description: Optional[str] = None
    platforms: List[str] = []
    deliverable: Optional[str] = None
    niche: Optional[str] = None
    work_url: Optional[str] = None
    results: Optional[str] = None
    period: Optional[str] = None
    created_at: datetime


class CreatorRichDetail(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    date_of_birth: Optional[date] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    ethnicity: Optional[str] = None
    education: Optional[str] = None
    primary_language: Optional[str] = None
    languages: List[str] = []
    country: Optional[str] = None
    city: Optional[str] = None
    completed: bool = False
    is_suspicious: bool = False

    # Gamification (computed on the fly if the stored column is NULL).
    rank: str = "bronze"
    xp: int = 0
    streak_days: int = 0
    awards: List[str] = []
    niches: List[str] = []

    creator_type: Optional[str] = None

    # Aggregated stats.
    total_views: int = 0
    total_earned: Decimal = Decimal("0")
    total_paid: Decimal = Decimal("0")  # actual Payout sum (all payment types)
    total_posts: int = 0
    total_likes: int = 0
    engagement_rate: float = 0.0

    socials: List[RichSocialItem] = []
    recent_submissions: List[RecentSubmissionItem] = []
    experiences: List[ExperienceItem] = []
    portfolio: List[PortfolioItemOut] = []
