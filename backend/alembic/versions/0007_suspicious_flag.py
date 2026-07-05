"""is_suspicious flag on submissions (bought-views guard, Clippers pattern)

Revision ID: 0007_suspicious_flag
Revises: 0006_payout_details
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_suspicious_flag"
down_revision: Union[str, None] = "0006_payout_details"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("submissions",
                  sa.Column("is_suspicious", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("submissions", "is_suspicious")
