"""creator payout details (where to send the money) — needed for the admin
Payments 'Pay now' modal to pre-fill a creator's actual payout method/address.

Revision ID: 0008_creator_payout_details
Revises: 0007_public_submit_source
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_creator_payout_details"
down_revision: Union[str, None] = "0007_public_submit_source"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("creator_profiles", sa.Column("payout_method", sa.Text(), nullable=True))   # paypal|solana|whop
    op.add_column("creator_profiles", sa.Column("payout_address", sa.Text(), nullable=True))  # email / wallet / handle


def downgrade() -> None:
    op.drop_column("creator_profiles", "payout_address")
    op.drop_column("creator_profiles", "payout_method")
