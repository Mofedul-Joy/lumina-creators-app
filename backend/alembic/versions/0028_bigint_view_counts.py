"""Widen submissions.views/likes/comments to BIGINT.

Viral posts overflow int32 — a 1.8B-view YouTube video scraped fine but the
UPDATE raised `integer out of range`. These are engagement counters that only
grow, so BIGINT is the correct type (the view_snapshots table already uses it).

Revision ID: 0028_bigint_views
Revises: 0027_contracts
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0028_bigint_views"
down_revision: Union[str, None] = "0027_contracts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLS = ("views", "likes", "comments")


def upgrade() -> None:
    for col in _COLS:
        op.alter_column("submissions", col, type_=sa.BigInteger())


def downgrade() -> None:
    # Safe only if no value exceeds int32; kept for symmetry.
    for col in _COLS:
        op.alter_column("submissions", col, type_=sa.Integer())
