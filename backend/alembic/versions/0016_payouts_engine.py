"""Payouts engine (Feature 4, SideShift-style — BUILD_SPEC.md §3.6) — adds a
system wallet + ledger (wallet_transactions), and extends payouts /
campaign_participations with the columns needed for auto-calc'd owed amounts
and Pay All (due_date, program_name, campaign_id, awarded_bonus_ids on
payouts; payout_awarded_bonus_ids on campaign_participations so bonus
milestones are never double-paid).

A single system-wide wallet (admin_id = NULL) is seeded on upgrade so the
admin Payments page always has a wallet to read/add funds to, even before any
admin-scoped wallets exist.

Revision ID: 0016_payouts_engine
Revises: 0015_campaign_wizard
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, UUID

revision: str = "0016_payouts_engine"
down_revision: Union[str, None] = "0015_campaign_wizard"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── wallets ──────────────────────────────────────────────────────────────
    op.create_table(
        "wallets",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "admin_id",
            UUID(as_uuid=True),
            sa.ForeignKey("admins.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("available_balance", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("pending_balance", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("currency", sa.Text(), nullable=False, server_default=sa.text("'USD'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    # NULL admin_id = the system-wide wallet. Only one of those should exist.
    op.create_index(
        "uq_wallets_system_wide",
        "wallets",
        ["admin_id"],
        unique=True,
        postgresql_where=sa.text("admin_id IS NULL"),
    )

    # ── wallet_transactions (ledger) ─────────────────────────────────────────
    op.create_table(
        "wallet_transactions",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "wallet_id",
            UUID(as_uuid=True),
            sa.ForeignKey("wallets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("reference", sa.Text(), nullable=True),
        sa.Column(
            "payout_id",
            UUID(as_uuid=True),
            sa.ForeignKey("payouts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "admin_id",
            UUID(as_uuid=True),
            sa.ForeignKey("admins.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "kind IN ('deposit', 'withdrawal', 'payout', 'refund', 'adjustment')",
            name="chk_wallet_txn_kind",
        ),
        sa.CheckConstraint("amount > 0", name="chk_wallet_txn_amount_positive"),
    )
    op.create_index(
        "idx_wallet_txn_wallet_created",
        "wallet_transactions",
        ["wallet_id", sa.text("created_at DESC")],
    )

    # Seed the default system-wide wallet.
    op.execute(
        "INSERT INTO wallets (admin_id, available_balance, pending_balance, currency) "
        "VALUES (NULL, 0, 0, 'USD')"
    )

    # ── payouts: due_date / program_name / campaign_id / awarded_bonus_ids ──
    op.add_column("payouts", sa.Column("due_date", sa.Date(), nullable=True))
    op.add_column("payouts", sa.Column("program_name", sa.Text(), nullable=True))
    op.add_column(
        "payouts",
        sa.Column(
            "campaign_id",
            UUID(as_uuid=True),
            sa.ForeignKey("campaigns.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "payouts",
        sa.Column(
            "awarded_bonus_ids", ARRAY(UUID(as_uuid=True)), nullable=False, server_default=sa.text("'{}'")
        ),
    )
    op.create_index("idx_payouts_campaign", "payouts", ["campaign_id"])

    # ── campaign_participations: payout_awarded_bonus_ids ───────────────────
    op.add_column(
        "campaign_participations",
        sa.Column(
            "payout_awarded_bonus_ids",
            ARRAY(UUID(as_uuid=True)),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("campaign_participations", "payout_awarded_bonus_ids")

    op.drop_index("idx_payouts_campaign", table_name="payouts")
    op.drop_column("payouts", "awarded_bonus_ids")
    op.drop_column("payouts", "campaign_id")
    op.drop_column("payouts", "program_name")
    op.drop_column("payouts", "due_date")

    op.drop_index("idx_wallet_txn_wallet_created", table_name="wallet_transactions")
    op.drop_table("wallet_transactions")

    op.drop_index("uq_wallets_system_wide", table_name="wallets")
    op.drop_table("wallets")
