"""Campaign example videos (with cached thumbnails).

A child table so each example carries its own {url, platform, thumbnail_url,
source}. Admin-added (link or upload) or auto-selected from top submissions;
the thumbnail is re-hosted on our storage. Existing `campaigns.example_videos`
URL arrays are migrated in as admin rows (thumbnails fill in on next fetch).

Revision ID: 0034_campaign_example_videos
Revises: 0033_experience_details
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0034_campaign_example_videos"
down_revision: Union[str, None] = "0033_experience_details"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "campaign_example_videos",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("platform", sa.Text()),
        sa.Column("thumbnail_url", sa.Text()),
        sa.Column("source", sa.Text(), nullable=False, server_default=sa.text("'admin'")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("campaign_id", "url", name="uq_example_campaign_url"),
    )
    op.create_index("idx_example_campaign", "campaign_example_videos", ["campaign_id"])
    # Migrate existing example_videos URL arrays into rows (admin source, no
    # thumbnail yet — the service fills it in when the example is next resolved).
    op.execute("""
        INSERT INTO campaign_example_videos (campaign_id, url, source, sort_order)
        SELECT c.id, u.url, 'admin', u.ord - 1
        FROM campaigns c
        CROSS JOIN LATERAL unnest(c.example_videos) WITH ORDINALITY AS u(url, ord)
        WHERE c.example_videos IS NOT NULL AND array_length(c.example_videos, 1) > 0
        ON CONFLICT (campaign_id, url) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_index("idx_example_campaign", table_name="campaign_example_videos")
    op.drop_table("campaign_example_videos")
