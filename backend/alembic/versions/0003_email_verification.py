"""email verification code fields on creators

Revision ID: 0003_email_verification
Revises: 0002_portfolio_link
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_email_verification"
down_revision: Union[str, None] = "0002_portfolio_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("creators", sa.Column("email_verification_code_hash", sa.Text(), nullable=True))
    op.add_column("creators", sa.Column("email_verification_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("creators", sa.Column("email_verification_sent_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("creators", "email_verification_sent_at")
    op.drop_column("creators", "email_verification_expires_at")
    op.drop_column("creators", "email_verification_code_hash")
