from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Numeric, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import PAYOUT_METHOD, PAYOUT_STATUS


class PaymentMethod(TimestampMixin, Base):
    __tablename__ = "payment_methods"
    __table_args__ = (
        CheckConstraint(
            "(method = 'paypal' AND paypal_email IS NOT NULL AND solana_address IS NULL "
            "AND whop_username IS NULL) OR "
            "(method = 'solana' AND solana_address IS NOT NULL AND paypal_email IS NULL "
            "AND whop_username IS NULL) OR "
            "(method = 'whop' AND whop_username IS NOT NULL AND paypal_email IS NULL "
            "AND solana_address IS NULL)",
            name="chk_method_fields",
        ),
        Index(
            "uq_default_method_per_creator",
            "creator_id",
            unique=True,
            postgresql_where=text("is_default"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE"), nullable=False
    )
    method: Mapped[str] = mapped_column(PAYOUT_METHOD, nullable=False)
    paypal_email: Mapped[Optional[str]] = mapped_column(Text)
    solana_address: Mapped[Optional[str]] = mapped_column(Text)
    whop_username: Mapped[Optional[str]] = mapped_column(Text)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))


class Payout(Base):
    __tablename__ = "payouts"
    __table_args__ = (
        CheckConstraint("amount > 0"),
        Index("idx_payouts_creator", "creator_id"),
        Index("idx_payouts_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creators.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    method: Mapped[str] = mapped_column(PAYOUT_METHOD, nullable=False)
    status: Mapped[str] = mapped_column(
        PAYOUT_STATUS, nullable=False, server_default=text("'requested'")
    )
    idempotency_key: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=False, server_default=text("gen_random_uuid()")
    )
    processed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admins.id")
    )
    external_ref: Mapped[Optional[str]] = mapped_column(Text)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class PayoutItem(Base):
    __tablename__ = "payout_items"
    __table_args__ = (
        CheckConstraint("amount > 0"),
        Index(
            "uq_active_payout_item",
            "submission_id",
            unique=True,
            postgresql_where=text("voided_at IS NULL"),
        ),
        Index("idx_payout_items_payout", "payout_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    payout_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payouts.id", ondelete="CASCADE"), nullable=False
    )
    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("submissions.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    voided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
