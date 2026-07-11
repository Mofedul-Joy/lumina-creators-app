"""Per-scrape view snapshots — the history behind the Views Growth chart.

`submissions.views` is a single current value that each scrape overwrites, so
there was no way to plot views over time. One row per successful scrape gives
the admin creator profile a real time series. History necessarily starts from
the first scrape after this ships; nothing can be backfilled.

Revision ID: 0023_view_snapshots
Revises: 0022_creator_removal
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0023_view_snapshots"
down_revision: Union[str, None] = "0022_creator_removal"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "submission_view_snapshots",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column(
            "submission_id",
            UUID(as_uuid=True),
            sa.ForeignKey("submissions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Denormalised so the per-creator chart is one indexed scan, not a join.
        sa.Column(
            "creator_id",
            UUID(as_uuid=True),
            sa.ForeignKey("creators.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("views", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("likes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("comments", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column(
            "captured_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "idx_snapshot_creator_time", "submission_view_snapshots", ["creator_id", "captured_at"]
    )


def downgrade() -> None:
    op.drop_index("idx_snapshot_creator_time", table_name="submission_view_snapshots")
    op.drop_table("submission_view_snapshots")
