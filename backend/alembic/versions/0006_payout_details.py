"""creator payout details (where to send the money) — ported from Clippers

Revision ID: 0006_payout_details
Revises: 0005_submission_created_index
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_payout_details"
down_revision: Union[str, None] = "0005_submission_created_index"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("creator_profiles", sa.Column("payout_method", sa.Text(), nullable=True))   # paypal|solana|whop
    op.add_column("creator_profiles", sa.Column("payout_address", sa.Text(), nullable=True))  # email / wallet / handle


def downgrade() -> None:
    op.drop_column("creator_profiles", "payout_address")
    op.drop_column("creator_profiles", "payout_method")
