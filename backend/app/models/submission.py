from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

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
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import PLATFORM, SCRAPE_JOB_STATUS, SCRAPE_STATUS, VERIFICATION_STATUS


class Submission(TimestampMixin, Base):
    __tablename__ = "submissions"
    __table_args__ = (
        CheckConstraint("views >= 0"),
        CheckConstraint("likes >= 0"),
        CheckConstraint("comments >= 0"),
        UniqueConstraint("campaign_id", "url_hash"),
        ForeignKeyConstraint(
            ["participation_id", "campaign_id", "creator_id"],
            [
                "campaign_participations.id",
                "campaign_participations.campaign_id",
                "campaign_participations.creator_id",
            ],
            ondelete="RESTRICT",
        ),
        Index("idx_sub_creator", "creator_id"),
        Index("idx_sub_campaign", "campaign_id"),
        Index("idx_sub_scrape", "scrape_status"),
        Index("idx_sub_verify", "verification_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    participation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    post_url: Mapped[str] = mapped_column(Text, nullable=False)
    canonical_url: Mapped[str] = mapped_column(Text, nullable=False)
    url_hash: Mapped[str] = mapped_column(Text, nullable=False)
    platform: Mapped[str] = mapped_column(PLATFORM, nullable=False)
    views: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    likes: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    comments: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    cpm_rate_snapshot: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    eligible_view_pct_snapshot: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, server_default=text("100")
    )
    estimated_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 4), nullable=False, server_default=text("0")
    )
    payable_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    finalized_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    scrape_status: Mapped[str] = mapped_column(
        SCRAPE_STATUS, nullable=False, server_default=text("'pending'")
    )
    verification_status: Mapped[str] = mapped_column(
        VERIFICATION_STATUS, nullable=False, server_default=text("'pending'")
    )
    verification_note: Mapped[Optional[str]] = mapped_column(Text)
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admins.id")
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    proof_object_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("storage_objects.id")
    )
    embed_broken: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    post_unavailable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    thumbnail_url: Mapped[Optional[str]] = mapped_column(Text)
    # Share count on the source post (Feature 2 rich media reel). Nullable so
    # existing rows stay valid — platforms without a shares metric leave this null.
    shares: Mapped[Optional[int]] = mapped_column(Integer)
    last_scraped_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Creator claimed this verified submission for payout (signals intent-to-pay
    # to the admin). Set once an active payout_item exists it becomes paid.
    claimed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Admin-flagged fraud signal on this one post, independent of the
    # account-level Creator.is_suspicious flag.
    is_suspicious: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))


class ScrapeJob(TimestampMixin, Base):
    __tablename__ = "scrape_jobs"
    __table_args__ = (Index("idx_scrape_due", "status", "next_run_at"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("submissions.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    status: Mapped[str] = mapped_column(
        SCRAPE_JOB_STATUS, nullable=False, server_default=text("'queued'")
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    max_attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("5"))
    last_apify_run_id: Mapped[Optional[str]] = mapped_column(Text)
    last_error: Mapped[Optional[str]] = mapped_column(Text)
    next_run_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
