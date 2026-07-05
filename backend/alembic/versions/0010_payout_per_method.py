"""Per-method payout addresses on creator_profiles.

A single payout_address was shared across every method, so switching from PayPal
to Whop showed (and reused) the same value. Store each method's address on its
own column; payout_address stays as the resolved address for the selected method
so downstream payout code is unchanged.

Revision ID: 0010_payout_per_method
Revises: 0009_submission_claimed_at
"""
from alembic import op
import sqlalchemy as sa

revision = "0010_payout_per_method"
down_revision = "0009_submission_claimed_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("creator_profiles", sa.Column("payout_paypal", sa.Text(), nullable=True))
    op.add_column("creator_profiles", sa.Column("payout_solana", sa.Text(), nullable=True))
    op.add_column("creator_profiles", sa.Column("payout_whop", sa.Text(), nullable=True))
    # Seed the per-method column from the existing single address.
    op.execute(
        """
        UPDATE creator_profiles
           SET payout_paypal = payout_address
         WHERE payout_method = 'paypal' AND payout_address IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE creator_profiles
           SET payout_solana = payout_address
         WHERE payout_method = 'solana' AND payout_address IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE creator_profiles
           SET payout_whop = payout_address
         WHERE payout_method = 'whop' AND payout_address IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("creator_profiles", "payout_whop")
    op.drop_column("creator_profiles", "payout_solana")
    op.drop_column("creator_profiles", "payout_paypal")
