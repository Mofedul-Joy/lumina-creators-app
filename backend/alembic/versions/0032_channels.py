"""Channels / group threads (messaging Phase 2C).

Revision ID: 0032_channels
Revises: 0031_conv_mute_archive
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0032_channels"
down_revision: Union[str, None] = "0031_conv_mute_archive"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("conversations", sa.Column("kind", sa.Text(), nullable=False, server_default=sa.text("'dm'")))
    op.add_column("conversations", sa.Column("title", sa.Text(), nullable=True))
    # Channels have no single creator — relax the DM-era NOT NULL.
    op.alter_column("conversations", "creator_id", existing_type=UUID(as_uuid=True), nullable=True)

    op.add_column("messages", sa.Column("sender_creator_id", UUID(as_uuid=True),
                                        sa.ForeignKey("creators.id", ondelete="SET NULL"), nullable=True))

    op.create_table(
        "conversation_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("conversation_id", UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("creator_id", UUID(as_uuid=True), sa.ForeignKey("creators.id", ondelete="CASCADE"), nullable=False),
        sa.Column("last_read_at", sa.DateTime(timezone=True)),
        sa.Column("muted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_conv_member_unique", "conversation_members", ["conversation_id", "creator_id"], unique=True)
    op.create_index("idx_conv_member_creator", "conversation_members", ["creator_id"])


def downgrade() -> None:
    op.drop_table("conversation_members")
    op.drop_column("messages", "sender_creator_id")
    op.alter_column("conversations", "creator_id", existing_type=UUID(as_uuid=True), nullable=True)
    op.drop_column("conversations", "title")
    op.drop_column("conversations", "kind")
