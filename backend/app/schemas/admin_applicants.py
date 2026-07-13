"""Admin applicants-pipeline schemas (Feature 1 — BUILD_SPEC.md §3.1, Rhys's #1 ask)."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel


class ApplicantVideo(BaseModel):
    id: str
    thumbnail_url: Optional[str] = None
    post_url: str
    platform: str
    views: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    caption: Optional[str] = None


class ApplicantSocial(BaseModel):
    platform: str
    handle: str
    profile_url: Optional[str] = None
    follower_count: int = 0


class ApplicantListItem(BaseModel):
    id: str  # participation id
    campaign_id: str
    campaign_name: str
    creator_id: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    country: Optional[str] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    age: Optional[int] = None
    status: str
    platforms: List[str] = []
    recent_videos: List[ApplicantVideo] = []
    views: int = 0
    earnings: Decimal = Decimal("0")
    applied_at: datetime
    admin_note: Optional[str] = None


class ApplicantDetail(BaseModel):
    id: str  # participation id
    campaign_id: str
    campaign_name: str
    creator_id: str
    email: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    primary_language: Optional[str] = None
    education: Optional[str] = None
    status: str
    views: int = 0
    earnings: Decimal = Decimal("0")
    posts: int = 0
    streak_days: int = 0
    socials: List[ApplicantSocial] = []
    recent_videos: List[ApplicantVideo] = []
    niches: List[str] = []
    admin_note: Optional[str] = None
    applied_at: datetime
    reviewed_at: Optional[datetime] = None
    messaged_at: Optional[datetime] = None
    bookmarked_at: Optional[datetime] = None
    declined_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None


class ApplicantUpdateIn(BaseModel):
    status: Optional[str] = None
    admin_note: Optional[str] = None


class ApplicantCounts(BaseModel):
    new: int = 0
    reviewed: int = 0
    messaged: int = 0
    declined: int = 0
    bookmarked: int = 0
    accepted: int = 0
    submitted: int = 0
    approved: int = 0
    rejected: int = 0


class OpenChatOut(BaseModel):
    conversation_id: str


class PendingCampaignItem(BaseModel):
    participation_id: str
    campaign_id: str
    campaign_name: str
    status: str
