"""creators can claim a verified submission for payout (submissions.claimed_at)

Revision ID: 0009_submission_claimed_at
Revises: 0008_creator_payout_details
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_submission_claimed_at"
down_revision: Union[str, None] = "0008_creator_payout_details"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("submissions", sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("submissions", "claimed_at")
