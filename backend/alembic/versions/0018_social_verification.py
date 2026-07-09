"""Social handle verification (bio-code method) — adds a short-lived
`verification_code` and its `verification_code_expires_at` to `social_accounts`.
The creator puts the code in their platform bio and hits Verify; the worker/API
scrapes the bio and, on a match, flips the existing `is_verified` flag. Both
columns are nullable and cleared once verified.

Revision ID: 0018_social_verification
Revises: 0017_campaign_share_token
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018_social_verification"
down_revision: Union[str, None] = "0017_campaign_share_token"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("social_accounts", sa.Column("verification_code", sa.Text(), nullable=True))
    op.add_column(
        "social_accounts",
        sa.Column("verification_code_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("social_accounts", "verification_code_expires_at")
    op.drop_column("social_accounts", "verification_code")
