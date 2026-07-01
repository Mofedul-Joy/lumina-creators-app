"""Creator profile schemas. Optional/List (not `X | None`) so Pydantic evals on 3.9."""
from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class ProfileIn(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    ethnicity: Optional[str] = None
    primary_language: Optional[str] = None
    languages: Optional[List[str]] = None
    country: Optional[str] = None
    city: Optional[str] = None
    avatar_object_id: Optional[str] = None


class ProfileOut(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    ethnicity: Optional[str] = None
    primary_language: Optional[str] = None
    languages: List[str] = []
    country: Optional[str] = None
    city: Optional[str] = None
    avatar_object_id: Optional[str] = None
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


class PortfolioIn(BaseModel):
    storage_object_id: str
    thumbnail_url: Optional[str] = None
    brand_name: Optional[str] = None
    caption: Optional[str] = None
    platform: Optional[str] = None


class PortfolioOut(BaseModel):
    id: str
    storage_object_id: str
    thumbnail_url: Optional[str] = None
    brand_name: Optional[str] = None
    caption: Optional[str] = None
    platform: Optional[str] = None


class CompletionOut(BaseModel):
    completed: bool
    missing: List[str]
