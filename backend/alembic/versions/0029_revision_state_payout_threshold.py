"""Revision-request review state + per-campaign payout threshold.

- verification_status gains 'revision_requested' — a soft bounce back to the
  creator (between verified and rejected) that doesn't scrape or pay.
- submissions.revision_mode records how the admin wants it fixed: 'edit' (amend
  the same submission) or 'repost' (post a brand-new video).
- campaigns.min_payout_amount lets the admin choose, per campaign, how much a
  creator must accumulate before requesting payout (null = global default).

Revision ID: 0029_revision_payout
Revises: 0028_bigint_views
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0029_revision_payout"
down_revision: Union[str, None] = "0028_bigint_views"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block; alembic's
    # autocommit_block commits the surrounding tx so this can execute on its own.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE verification_status ADD VALUE IF NOT EXISTS 'revision_requested'")
    op.add_column("submissions", sa.Column("revision_mode", sa.String(), nullable=True))
    op.add_column("campaigns", sa.Column("min_payout_amount", sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    # Postgres can't drop a single enum value; leaving 'revision_requested' in
    # place is harmless. Only the added columns are reversible.
    op.drop_column("campaigns", "min_payout_amount")
    op.drop_column("submissions", "revision_mode")
