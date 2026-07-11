from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import (
    CAMPAIGN_MODE,
    CAMPAIGN_STATUS,
    PARTICIPATION_STATUS,
    PLATFORM,
)


class Campaign(TimestampMixin, Base):
    __tablename__ = "campaigns"
    __table_args__ = (
        CheckConstraint("cpm_rate > 0"),
        CheckConstraint("budget > 0"),
        CheckConstraint("max_payout_per_creator IS NULL OR max_payout_per_creator > 0"),
        CheckConstraint("eligible_view_pct BETWEEN 0 AND 100"),
        CheckConstraint("min_retention_days >= 0"),
        CheckConstraint("spent_amount >= 0"),
        CheckConstraint(
            "(mode = 'create_new' AND brief_script IS NOT NULL AND btrim(brief_script) <> '' "
            "AND content_drive_url IS NULL) OR "
            "(mode = 'copy_paste' AND content_drive_url IS NOT NULL "
            "AND btrim(content_drive_url) <> '')",
            name="chk_mode_content",
        ),
        CheckConstraint(
            "starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at",
            name="chk_dates",
        ),
        CheckConstraint(
            "status = 'draft' OR array_length(platforms, 1) >= 1",
            name="chk_platforms_when_live",
        ),
        Index("idx_campaigns_status", "status"),
        Index("idx_campaigns_mode", "mode"),
        Index("idx_campaigns_client", "client_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admins.id"), nullable=False
    )
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    mode: Mapped[str] = mapped_column(CAMPAIGN_MODE, nullable=False)
    status: Mapped[str] = mapped_column(
        CAMPAIGN_STATUS, nullable=False, server_default=text("'draft'")
    )
    cpm_rate: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    budget: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    max_payout_per_creator: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
    eligible_view_pct: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, server_default=text("100")
    )
    min_retention_days: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("30")
    )
    spent_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, server_default=text("0")
    )
    platforms: Mapped[List[str]] = mapped_column(
        ARRAY(PLATFORM), nullable=False, server_default=text("'{}'::platform[]")
    )
    geo_countries: Mapped[List[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'::text[]")
    )
    brief_script: Mapped[Optional[str]] = mapped_column(Text)
    content_drive_url: Mapped[Optional[str]] = mapped_column(Text)
    caption_rules: Mapped[Optional[str]] = mapped_column(Text)
    required_mentions: Mapped[List[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'::text[]")
    )
    example_captions: Mapped[List[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'::text[]")
    )
    requirements_url: Mapped[Optional[str]] = mapped_column(Text)
    brand_name: Mapped[Optional[str]] = mapped_column(Text)
    brand_logo_url: Mapped[Optional[str]] = mapped_column(Text)
    starts_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # ── 6-step campaign builder wizard (Feature 3, BUILD_SPEC.md §3.3) ─────────
    job_type: Mapped[Optional[str]] = mapped_column(Text)  # sales|marketing|content_creator|ambassador|other
    creator_type: Mapped[Optional[str]] = mapped_column(Text)  # ugc_ads|high_volume_ugc|influencer|creator_manager|other
    payment_type: Mapped[Optional[str]] = mapped_column(Text)  # fixed|cpm|mixed|per_hour|per_post
    fixed_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
    weekly_hours_needed: Mapped[Optional[int]] = mapped_column(Integer)
    hourly_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
    required_hours: Mapped[Optional[int]] = mapped_column(Integer)
    per_post_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
    example_videos: Mapped[List[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'::text[]")
    )
    age_requirement: Mapped[Optional[str]] = mapped_column(Text)
    platform_focus: Mapped[List[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'::text[]")
    )
    content_type: Mapped[Optional[str]] = mapped_column(Text)
    posting_frequency: Mapped[Optional[str]] = mapped_column(Text)
    video_length: Mapped[Optional[str]] = mapped_column(Text)
    account_type: Mapped[Optional[str]] = mapped_column(Text)
    is_app: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    physical_product: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    banner_url: Mapped[Optional[str]] = mapped_column(Text)

    # ── Campaign creation flow (0024) ─────────────────────────────────────────
    # high_volume_ugc|influencer|paid_ads|campaign_manager|analytics_only
    campaign_kind: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'high_volume_ugc'")
    )
    # essentials = the short path; advanced = every option exposed.
    experience_level: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'essentials'")
    )
    # Pay without tracking platform stats at all — a fixed/per-post campaign
    # doesn't need view counts.
    no_platform_tracking: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    payment_schedule: Mapped[Optional[str]] = mapped_column(Text)  # every_7_days|every_14_days|every_30_days
    payment_cycle_trigger: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'post_delivery'")
    )  # post_delivery|schedule
    pro_rata: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    min_views: Mapped[Optional[int]] = mapped_column(Integer)   # NULL = no minimum
    posts_per_payment: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))

    # ── Client read-only report + share_token (Feature 6, BUILD_SPEC.md §3.7) ──
    share_token: Mapped[Optional[str]] = mapped_column(Text, unique=True)
    share_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))


class CampaignBonusMilestone(Base):
    """Repeatable views-threshold bonus rows (step 3 of the wizard)."""

    __tablename__ = "campaign_bonus_milestones"
    __table_args__ = (
        Index("idx_bonus_milestones_campaign", "campaign_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
    )
    views_threshold: Mapped[int] = mapped_column(Integer, nullable=False)
    bonus_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))


class CampaignParticipation(Base):
    __tablename__ = "campaign_participations"
    __table_args__ = (
        UniqueConstraint("campaign_id", "creator_id"),
        UniqueConstraint("id", "campaign_id", "creator_id"),
        Index("idx_part_campaign", "campaign_id"),
        Index("idx_part_creator", "creator_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="RESTRICT"), nullable=False
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creators.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        PARTICIPATION_STATUS, nullable=False, server_default=text("'joined'")
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    messaged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    bookmarked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Admin removed the creator from this campaign. Marked, not deleted — a
    # submission hangs off this row, and payouts are RESTRICT against it.
    removed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    declined_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    admin_note: Mapped[Optional[str]] = mapped_column(Text)
    # Payouts engine (Feature 4, BUILD_SPEC.md §3.6): bonus_milestone ids
    # already paid out for this participation — prevents Pay All / pay-one
    # from double-awarding the same views-threshold bonus.
    payout_awarded_bonus_ids: Mapped[List[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=False, server_default=text("'{}'")
    )


class CampaignInvite(Base):
    """An admin invite to ONE campaign. `creator_id` set → existing creator
    (delivered as a notification + email); `email`+`token` set → outsider
    (emailed a /signup?invite=<token> link that auto-joins on signup); both null
    → the reusable link-only invite behind "Copy invite link". An invite is
    "open" until accepted/declined/revoked."""
    __tablename__ = "campaign_invites"
    __table_args__ = (
        Index("idx_cinvite_campaign", "campaign_id"),
        Index("idx_cinvite_creator", "creator_id"),
        Index(
            "uq_cinvite_open_creator", "campaign_id", "creator_id", unique=True,
            postgresql_where=text("creator_id IS NOT NULL AND accepted_at IS NULL "
                                  "AND declined_at IS NULL AND revoked_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
    )
    creator_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE")
    )
    email: Mapped[Optional[str]] = mapped_column(Text)
    token: Mapped[Optional[str]] = mapped_column(Text, unique=True)
    created_by_admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admins.id", ondelete="SET NULL")
    )
    email_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    accepted_creator_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creators.id", ondelete="SET NULL")
    )
    declined_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
