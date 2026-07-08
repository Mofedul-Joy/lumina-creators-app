"""Client read-only report + campaign share_token (Feature 6, BUILD_SPEC.md
§3.7) — adds a high-entropy, nullable `share_token` and a `share_enabled`
flag to `campaigns` so an admin can mint a copyable, no-login "read-only
performance page" link for a client. The unique index on share_token doubles
as the fast-lookup path for the public GET /public/report/{token} endpoint.

Revision ID: 0017_campaign_share_token
Revises: 0016_payouts_engine
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017_campaign_share_token"
down_revision: Union[str, None] = "0016_payouts_engine"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("campaigns", sa.Column("share_token", sa.Text(), nullable=True))
    op.add_column(
        "campaigns",
        sa.Column("share_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index(
        "uq_campaigns_share_token", "campaigns", ["share_token"], unique=True
    )


def downgrade() -> None:
    op.drop_index("uq_campaigns_share_token", table_name="campaigns")
    op.drop_column("campaigns", "share_enabled")
    op.drop_column("campaigns", "share_token")
