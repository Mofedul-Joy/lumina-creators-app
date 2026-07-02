"""index submissions.created_at for the analytics daily rollup

Revision ID: 0005_submission_created_index
Revises: 0004_email_verify_attempts
"""
from typing import Union

from alembic import op

revision: str = "0005_submission_created_index"
down_revision: Union[str, None] = "0004_email_verify_attempts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("idx_sub_created", "submissions", ["created_at"])


def downgrade() -> None:
    op.drop_index("idx_sub_created", table_name="submissions")
