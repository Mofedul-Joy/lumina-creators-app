"""Conversation mute + archive flags (messaging Phase 2, three-dots menu).

Revision ID: 0031_conv_mute_archive
Revises: 0030_messaging
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0031_conv_mute_archive"
down_revision: Union[str, None] = "0030_messaging"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("conversations", sa.Column("admin_muted", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("conversations", sa.Column("creator_muted", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("conversations", sa.Column("admin_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")))


def downgrade() -> None:
    op.drop_column("conversations", "admin_archived")
    op.drop_column("conversations", "creator_muted")
    op.drop_column("conversations", "admin_muted")
