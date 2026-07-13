"""Richer creator experiences (Bill's feedback).

The Add Experience flow captured almost nothing (brand + type). This adds the
context a UGC creator actually expects to show off: what they did, on which
platforms, the deliverable, niche, a link to the work, results, and a period.
All nullable (platforms defaults to empty array) so every existing row stays
valid and only the brand/client name is required by the form.

Revision ID: 0033_experience_details
Revises: 0032_channels
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0033_experience_details"
down_revision: Union[str, None] = "0032_channels"
branch_labels = None
depends_on = None

_COLS = ("description", "deliverable", "niche", "work_url", "results", "period")


def upgrade() -> None:
    for col in _COLS:
        op.add_column("creator_experiences", sa.Column(col, sa.Text(), nullable=True))
    op.add_column(
        "creator_experiences",
        sa.Column(
            "platforms",
            postgresql.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
    )


def downgrade() -> None:
    op.drop_column("creator_experiences", "platforms")
    for col in _COLS:
        op.drop_column("creator_experiences", col)
