"""Let a message carry a deep link.

A review DM ("your video needs changes") is only useful if the creator can act
on it. Storing the target here lets the message bubble route straight to the
submission that needs the fix, instead of dumping them on a list page where
they have to guess which video the admin meant.

Nullable and unused by ordinary chat, so existing rows and the normal send path
are unaffected.

Revision ID: 0043
Revises: 0042
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0043"
down_revision: Union[str, None] = "0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("link", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("messages", "link")
