"""applicants pipeline — participation_status enum values + timeline/note columns
(Feature 1, SideShift-style admin triage — Rhys's #1 ask, BUILD_SPEC.md §3.1)

Revision ID: 0013_applicants_pipeline
Revises: 0012_creator_education
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013_applicants_pipeline"
down_revision: Union[str, None] = "0012_creator_education"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # New enum values must each run in their own statement, outside an implicit
    # transaction block (Postgres restriction on ALTER TYPE ... ADD VALUE).
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE participation_status ADD VALUE IF NOT EXISTS 'reviewed'")
        op.execute("ALTER TYPE participation_status ADD VALUE IF NOT EXISTS 'messaged'")
        op.execute("ALTER TYPE participation_status ADD VALUE IF NOT EXISTS 'declined'")
        op.execute("ALTER TYPE participation_status ADD VALUE IF NOT EXISTS 'bookmarked'")
        op.execute("ALTER TYPE participation_status ADD VALUE IF NOT EXISTS 'accepted'")

    op.add_column("campaign_participations", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("campaign_participations", sa.Column("messaged_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("campaign_participations", sa.Column("bookmarked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("campaign_participations", sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("campaign_participations", sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("campaign_participations", sa.Column("admin_note", sa.Text(), nullable=True))


def downgrade() -> None:
    # Postgres cannot drop enum values — downgrade only removes the new columns.
    op.drop_column("campaign_participations", "admin_note")
    op.drop_column("campaign_participations", "accepted_at")
    op.drop_column("campaign_participations", "declined_at")
    op.drop_column("campaign_participations", "bookmarked_at")
    op.drop_column("campaign_participations", "messaged_at")
    op.drop_column("campaign_participations", "reviewed_at")
