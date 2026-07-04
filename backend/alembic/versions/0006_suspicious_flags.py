"""add soft fraud-flag columns: creators.is_suspicious, submissions.is_suspicious

Revision ID: 0006_suspicious_flags
Revises: 0005_submission_created_index
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_suspicious_flags"
down_revision: Union[str, None] = "0005_submission_created_index"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "creators",
        sa.Column("is_suspicious", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "submissions",
        sa.Column("is_suspicious", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index("idx_creators_suspicious", "creators", ["is_suspicious"])
    op.create_index("idx_sub_suspicious", "submissions", ["is_suspicious"])


def downgrade() -> None:
    op.drop_index("idx_sub_suspicious", table_name="submissions")
    op.drop_index("idx_creators_suspicious", table_name="creators")
    op.drop_column("submissions", "is_suspicious")
    op.drop_column("creators", "is_suspicious")
