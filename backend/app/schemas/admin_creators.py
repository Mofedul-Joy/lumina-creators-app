"""Admin creator-database schemas (list + drill-down). Optional/List for 3.9 Pydantic."""
from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class RecentVideo(BaseModel):
    thumbnail_url: Optional[str] = None
    post_url: str
    platform: str
    views: int = 0


class SocialItem(BaseModel):
    platform: str
    handle: str
    profile_url: Optional[str] = None
    follower_count: int


class CreatorListItem(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    gender: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    primary_language: Optional[str] = None
    total_followers: int = 0
    platforms: List[str] = []
    socials: List[SocialItem] = []
    recent_videos: List[RecentVideo] = []
    completed: bool = False


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
    socials: List[SocialItem]
    recent_videos: List[RecentVideo] = []
    portfolio: List[PortfolioItemOut] = []
