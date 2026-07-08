"""creator gamification + richer media (Feature 2, SideShift-style rich detail
card — BUILD_SPEC.md §3.1 detail panel + §3.9 gamification)

Adds gemstone rank / xp / streak / awards / niches to creator_profiles, adds
shares to submissions (thumbnail_url already exists), and creates a simple
creator_experiences table for résumé-style entries shown on the rich card.

Revision ID: 0014_creator_gamification_and_richer_media
Revises: 0013_applicants_pipeline
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, UUID

revision: str = "0014_creator_gamif"
down_revision: Union[str, None] = "0013_applicants_pipeline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── creator_profiles: gemstone rank + xp + streak + awards + niches ────────
    op.add_column("creator_profiles", sa.Column("rank", sa.Text(), nullable=True))
    op.add_column(
        "creator_profiles",
        sa.Column("xp", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "creator_profiles",
        sa.Column("streak_days", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "creator_profiles",
        sa.Column(
            "awards", ARRAY(sa.Text()), nullable=False, server_default=sa.text("'{}'::text[]")
        ),
    )
    op.add_column(
        "creator_profiles",
        sa.Column(
            "niches", ARRAY(sa.Text()), nullable=False, server_default=sa.text("'{}'::text[]")
        ),
    )

    # ── submissions: shares count (thumbnail_url already exists on this model) ─
    op.add_column(
        "submissions",
        sa.Column("shares", sa.Integer(), nullable=True),
    )

    # ── creator_experiences: simple résumé-style entries ───────────────────────
    op.create_table(
        "creator_experiences",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "creator_id",
            UUID(as_uuid=True),
            sa.ForeignKey("creators.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("org", sa.Text(), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("idx_experiences_creator", "creator_experiences", ["creator_id"])


def downgrade() -> None:
    op.drop_index("idx_experiences_creator", table_name="creator_experiences")
    op.drop_table("creator_experiences")
    op.drop_column("submissions", "shares")
    op.drop_column("creator_profiles", "niches")
    op.drop_column("creator_profiles", "awards")
    op.drop_column("creator_profiles", "streak_days")
    op.drop_column("creator_profiles", "xp")
    op.drop_column("creator_profiles", "rank")
