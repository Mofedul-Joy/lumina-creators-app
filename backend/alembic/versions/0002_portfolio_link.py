"""portfolio items reference a video URL instead of an uploaded object

Revision ID: 0002_portfolio_link
Revises: 0001_baseline
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_portfolio_link"
down_revision: Union[str, None] = "0001_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("portfolio_items", sa.Column("video_url", sa.Text(), nullable=True))
    op.alter_column("portfolio_items", "storage_object_id", nullable=True)


def downgrade() -> None:
    op.alter_column("portfolio_items", "storage_object_id", nullable=False)
    op.drop_column("portfolio_items", "video_url")
