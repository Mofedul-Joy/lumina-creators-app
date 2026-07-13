from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import GENDER, PLATFORM, STORAGE_PURPOSE, STORAGE_STATUS


class StorageObject(Base):
    __tablename__ = "storage_objects"
    __table_args__ = (
        UniqueConstraint("bucket", "object_key"),
        Index("idx_storage_owner", "owner_creator_id"),
        Index("idx_storage_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    owner_creator_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE")
    )
    purpose: Mapped[str] = mapped_column(STORAGE_PURPOSE, nullable=False)
    bucket: Mapped[str] = mapped_column(Text, nullable=False)
    object_key: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[Optional[str]] = mapped_column(Text)
    size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger)
    checksum_sha256: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        STORAGE_STATUS, nullable=False, server_default=text("'pending'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    finalized_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class CreatorProfile(TimestampMixin, Base):
    __tablename__ = "creator_profiles"
    __table_args__ = (
        Index("idx_profiles_gender", "gender"),
        Index("idx_profiles_country", "country"),
        Index("idx_profiles_city", "city"),
        Index("idx_profiles_dob", "date_of_birth"),
        Index("idx_profiles_ethnicity", "ethnicity"),
        Index("idx_profiles_language", "primary_language"),
        Index("idx_profiles_languages", "languages", postgresql_using="gin"),
        Index("idx_profiles_completed", "completed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    display_name: Mapped[Optional[str]] = mapped_column(Text)
    creator_type: Mapped[Optional[str]] = mapped_column(Text)  # ugc|influencer|both
    avatar_object_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storage_objects.id")
    )
    bio: Mapped[Optional[str]] = mapped_column(Text)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    gender: Mapped[Optional[str]] = mapped_column(GENDER)
    ethnicity: Mapped[Optional[str]] = mapped_column(Text)
    education: Mapped[Optional[str]] = mapped_column(Text)  # in_high_school|in_college|graduated|grad_school|no_college|na
    primary_language: Mapped[Optional[str]] = mapped_column(Text)
    languages: Mapped[List[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'::text[]")
    )
    country: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(Text)
    phone: Mapped[Optional[str]] = mapped_column(Text)
    payout_method: Mapped[Optional[str]] = mapped_column(Text)   # preferred: paypal|solana|whop
    payout_address: Mapped[Optional[str]] = mapped_column(Text)  # resolved address for payout_method
    # Per-method addresses so switching method keeps each one's own value.
    payout_paypal: Mapped[Optional[str]] = mapped_column(Text)
    payout_solana: Mapped[Optional[str]] = mapped_column(Text)
    payout_whop: Mapped[Optional[str]] = mapped_column(Text)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Gamification layer (Feature 2 — SideShift-style rich detail card,
    # BUILD_SPEC.md §3.9). `rank` is nullable: when NULL the service computes
    # the gemstone rank on the fly from `xp` so existing rows keep working.
    rank: Mapped[Optional[str]] = mapped_column(Text)  # bronze|sapphire|gold|emerald|amber|ruby
    xp: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    streak_days: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    awards: Mapped[List[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'::text[]")
    )
    niches: Mapped[List[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'::text[]")
    )


class SocialAccount(Base):
    __tablename__ = "social_accounts"
    __table_args__ = (
        CheckConstraint("follower_count >= 0"),
        UniqueConstraint("creator_id", "platform", "handle"),
        Index("idx_social_creator", "creator_id"),
        Index("idx_social_platform_follows", "platform", "follower_count"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE"), nullable=False
    )
    platform: Mapped[str] = mapped_column(PLATFORM, nullable=False)
    handle: Mapped[str] = mapped_column(Text, nullable=False)
    profile_url: Mapped[Optional[str]] = mapped_column(Text)
    follower_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    # Bio-code verification: the code the creator must place in their platform bio,
    # and its expiry. Both cleared once is_verified flips true.
    verification_code: Mapped[Optional[str]] = mapped_column(Text)
    verification_code_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class PortfolioItem(Base):
    __tablename__ = "portfolio_items"
    __table_args__ = (Index("idx_portfolio_creator", "creator_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE"), nullable=False
    )
    storage_object_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storage_objects.id")
    )
    video_url: Mapped[Optional[str]] = mapped_column(Text)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(Text)
    brand_name: Mapped[Optional[str]] = mapped_column(Text)
    caption: Mapped[Optional[str]] = mapped_column(Text)
    platform: Mapped[Optional[str]] = mapped_column(PLATFORM)
    # "Top Videos" (link entries the creator curates, max 3) vs uploaded videos.
    is_top_content: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    views: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text("0"))
    likes: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class CreatorExperience(Base):
    """Résumé-style entry (past brand deal, paid ad, or professional role) shown
    on the creator's own Experiences tab and on the rich admin detail card
    (Feature 2). Creator-authored (Feature 3) and auto-verified — there is no
    manual review step."""

    __tablename__ = "creator_experiences"
    __table_args__ = (Index("idx_experiences_creator", "creator_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE"), nullable=False
    )
    # organic_ugc | ugc_paid_ad | professional_role  (chk_experience_kind)
    kind: Mapped[str] = mapped_column(Text, nullable=False, server_default="professional_role")
    # For professional_role this is the job title; otherwise the type's label.
    title: Mapped[str] = mapped_column(Text, nullable=False)
    org: Mapped[Optional[str]] = mapped_column(Text)   # brand/client name
    url: Mapped[Optional[str]] = mapped_column(Text)   # company/brand website
    # Richer résumé context (Bill's feedback: "add experience doesn't feel
    # complete — say what you did there"). All nullable so every existing row
    # stays valid; the form asks for brand + these, only brand is required.
    description: Mapped[Optional[str]] = mapped_column(Text)     # what you did / impact
    platforms: Mapped[List[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'::text[]")
    )
    deliverable: Mapped[Optional[str]] = mapped_column(Text)     # e.g. "Short-form video"
    niche: Mapped[Optional[str]] = mapped_column(Text)
    work_url: Mapped[Optional[str]] = mapped_column(Text)        # link to the actual work
    results: Mapped[Optional[str]] = mapped_column(Text)         # results / metrics (freeform)
    period: Mapped[Optional[str]] = mapped_column(Text)          # date/duration (freeform)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
