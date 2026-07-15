"""Creator profile schemas. Optional/List (not `X | None`) so Pydantic evals on 3.9."""
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class ProfileIn(BaseModel):
    display_name: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=40)
    whatsapp: Optional[str] = Field(None, max_length=40)
    creator_type: Optional[str] = None   # ugc | influencer | both
    bio: Optional[str] = Field(None, max_length=2000)
    date_of_birth: Optional[date] = None

    @field_validator("date_of_birth")
    @classmethod
    def _dob_in_past(cls, v: Optional[date]) -> Optional[date]:
        # A DOB in the future (or absurdly old) is nonsense — reject with a 422
        # instead of storing it. 13+ isn't enforced here (no ToS age gate yet).
        if v is not None and (v >= date.today() or v.year < 1900):
            raise ValueError("Enter a valid date of birth in the past.")
        return v
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
    niches: Optional[List[str]] = None
    onboarding: Optional[Dict[str, Any]] = None


class ProfileOut(BaseModel):
    display_name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
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
    niches: List[str] = []
    onboarding: Dict[str, Any] = {}
    completed: bool = False
    missing: List[str] = []


class SocialIn(BaseModel):
    platform: str
    handle: str = Field(..., max_length=120)
    profile_url: Optional[str] = Field(None, max_length=500)
    # Bounded to 32-bit INT (the DB column) so a huge value returns a clean 422
    # instead of an unhandled 500 on the insert.
    follower_count: int = Field(0, ge=0, le=2_147_483_647)


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
    code: Optional[str] = None          # None when already verified
    expires_at: Optional[datetime] = None
    instructions: str
    already_verified: bool = False


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
    is_top_content: bool = False
    views: int = 0
    likes: int = 0


class TopVideoIn(BaseModel):
    platform: str   # tiktok | instagram
    video_url: str


class TopVideoOut(BaseModel):
    id: str
    platform: Optional[str] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    views: int = 0
    likes: int = 0


class ExperienceIn(BaseModel):
    kind: str                            # organic_ugc | ugc_paid_ad | professional_role
    role_title: Optional[str] = None     # required when kind == professional_role
    company_name: Optional[str] = None   # brand/client — now the primary required field
    company_url: Optional[str] = None    # brand website (optional)
    description: Optional[str] = None     # what you did / impact
    platforms: Optional[List[str]] = None
    deliverable: Optional[str] = None
    niche: Optional[str] = None
    work_url: Optional[str] = None        # link to the actual work
    results: Optional[str] = None         # results / metrics
    period: Optional[str] = None          # date / duration


class ExperienceOut(BaseModel):
    id: str
    kind: str
    kind_label: str                      # "Organic UGC" / "UGC paid ad" / "Professional role"
    title: str                           # job title, or the type label
    org: Optional[str] = None            # brand/client name
    url: Optional[str] = None
    description: Optional[str] = None
    platforms: List[str] = []
    deliverable: Optional[str] = None
    niche: Optional[str] = None
    work_url: Optional[str] = None
    results: Optional[str] = None
    period: Optional[str] = None
    verified: bool
    created_at: datetime


class CompletionOut(BaseModel):
    completed: bool
    missing: List[str]
    # Per-section done flags + the first section the creator still needs to finish,
    # so the "complete your profile" popup can route them straight there.
    sections: dict = {}
    next_section: Optional[str] = None
