from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
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

    # ── Payouts engine (Feature 4, BUILD_SPEC.md §3.6) ──────────────────────
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    program_name: Mapped[Optional[str]] = mapped_column(Text)
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="SET NULL")
    )
    awarded_bonus_ids: Mapped[List[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=False, server_default=text("'{}'")
    )


class Wallet(Base):
    """A pool of funds an admin pays creators from. A NULL admin_id is the
    single system-wide wallet seeded by the payouts-engine migration — most
    deployments only ever use that one wallet."""

    __tablename__ = "wallets"
    __table_args__ = (
        Index("uq_wallets_system_wide", "admin_id", unique=True, postgresql_where=text("admin_id IS NULL")),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admins.id", ondelete="SET NULL")
    )
    available_balance: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, server_default=text("0")
    )
    pending_balance: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, server_default=text("0")
    )
    currency: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'USD'"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class WalletTransaction(Base):
    """The wallet ledger — one row per deposit/withdrawal/payout/refund/
    adjustment. `amount` is always positive; direction is inferred from
    `kind` (deposit/refund credit the wallet, withdrawal/payout debit it)."""

    __tablename__ = "wallet_transactions"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('deposit', 'withdrawal', 'payout', 'refund', 'adjustment')",
            name="chk_wallet_txn_kind",
        ),
        CheckConstraint("amount > 0", name="chk_wallet_txn_amount_positive"),
        Index("idx_wallet_txn_wallet_created", "wallet_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    wallet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    reference: Mapped[Optional[str]] = mapped_column(Text)
    payout_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payouts.id", ondelete="SET NULL")
    )
    admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admins.id", ondelete="SET NULL")
    )
    note: Mapped[Optional[str]] = mapped_column(Text)
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
