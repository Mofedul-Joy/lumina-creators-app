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


class SocialItem(BaseModel):
    platform: str
    handle: str
    profile_url: Optional[str] = None
    follower_count: int


class PortfolioItemOut(BaseModel):
    id: str
    brand_name: Optional[str] = None
    caption: Optional[str] = None
    platform: Optional[str] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None


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


# ── Feature 2: rich creator/applicant detail card (BUILD_SPEC.md §3.1 + §3.9) ──

class RichSocialItem(BaseModel):
    platform: str
    handle: str
    profile_url: Optional[str] = None
    follower_count: int = 0


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

    # Aggregated stats.
    total_views: int = 0
    total_earned: Decimal = Decimal("0")
    total_posts: int = 0

    socials: List[RichSocialItem] = []
    recent_submissions: List[RecentSubmissionItem] = []
    experiences: List[ExperienceItem] = []
    portfolio: List[PortfolioItemOut] = []
