"""Portfolio "Top Videos": link-based top content with view/like counts.

Reuses portfolio_items (per the backlog) rather than a new table. `is_top_content`
marks the up-to-3 link entries the creator curates on the Top Videos tab, kept
distinct from uploaded portfolio videos; views/likes hold their scraped stats.

Revision ID: 0025_top_videos
Revises: 0024_campaign_flow
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0025_top_videos"
down_revision: Union[str, None] = "0024_campaign_flow"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "portfolio_items",
        sa.Column("is_top_content", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("portfolio_items", sa.Column("views", sa.BigInteger(), nullable=False, server_default="0"))
    op.add_column("portfolio_items", sa.Column("likes", sa.BigInteger(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("portfolio_items", "likes")
    op.drop_column("portfolio_items", "views")
    op.drop_column("portfolio_items", "is_top_content")
