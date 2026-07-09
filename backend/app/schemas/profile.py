"""Creator profile schemas. Optional/List (not `X | None`) so Pydantic evals on 3.9."""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel


class ProfileIn(BaseModel):
    display_name: Optional[str] = None
    creator_type: Optional[str] = None   # ugc | influencer | both
    bio: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    ethnicity: Optional[str] = None
    education: Optional[str] = None
    primary_language: Optional[str] = None
    languages: Optional[List[str]] = None
    country: Optional[str] = None
    city: Optional[str] = None
    avatar_object_id: Optional[str] = None
    payout_method: Optional[str] = None   # paypal | solana | whop
    payout_address: Optional[str] = None  # legacy single address (still accepted)
    payout_paypal: Optional[str] = None
    payout_solana: Optional[str] = None
    payout_whop: Optional[str] = None


class ProfileOut(BaseModel):
    display_name: Optional[str] = None
    creator_type: Optional[str] = None
    bio: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    ethnicity: Optional[str] = None
    education: Optional[str] = None
    primary_language: Optional[str] = None
    languages: List[str] = []
    country: Optional[str] = None
    city: Optional[str] = None
    avatar_object_id: Optional[str] = None
    avatar_url: Optional[str] = None
    payout_method: Optional[str] = None
    payout_address: Optional[str] = None
    payout_paypal: Optional[str] = None
    payout_solana: Optional[str] = None
    payout_whop: Optional[str] = None
    completed: bool = False
    missing: List[str] = []


class SocialIn(BaseModel):
    platform: str
    handle: str
    profile_url: Optional[str] = None
    follower_count: int = 0


class SocialOut(BaseModel):
    id: str
    platform: str
    handle: str
    profile_url: Optional[str] = None
    follower_count: int
    is_verified: bool


class SocialVerifyIn(BaseModel):
    platform: str
    handle: str


class SocialVerifyStartOut(BaseModel):
    platform: str
    handle: str
    code: str
    expires_at: Optional[datetime] = None
    instructions: str


class PortfolioIn(BaseModel):
    # Either an uploaded video (storage_object_id, the primary path now) OR a
    # legacy external link (video_url). One of the two is required.
    storage_object_id: Optional[str] = None
    video_url: Optional[str] = None
    brand_name: Optional[str] = None
    caption: Optional[str] = None
    platform: Optional[str] = None


class PortfolioOut(BaseModel):
    id: str
    video_url: Optional[str] = None   # playable URL (R2 for uploads, external for links)
    thumbnail_url: Optional[str] = None
    is_upload: bool = False           # true = an uploaded video file, render a player
    brand_name: Optional[str] = None
    caption: Optional[str] = None
    platform: Optional[str] = None


class CompletionOut(BaseModel):
    completed: bool
    missing: List[str]
