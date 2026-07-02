"""track failed email-verification attempts (brute-force lockout)

Revision ID: 0004_email_verify_attempts
Revises: 0003_email_verification
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_email_verify_attempts"
down_revision: Union[str, None] = "0003_email_verification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "creators",
        sa.Column("email_verification_attempts", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("creators", "email_verification_attempts")
