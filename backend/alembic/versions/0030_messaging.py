"""Admin↔creator direct messaging: conversations + messages.

Revision ID: 0030_messaging
Revises: 0029_revision_payout
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0030_messaging"
down_revision: Union[str, None] = "0029_revision_payout"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "conversations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("creator_id", UUID(as_uuid=True), sa.ForeignKey("creators.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("admin_last_read_at", sa.DateTime(timezone=True)),
        sa.Column("creator_last_read_at", sa.DateTime(timezone=True)),
        sa.Column("last_message_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_conversation_last_msg", "conversations", ["last_message_at"])

    op.create_table(
        "messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("conversation_id", UUID(as_uuid=True), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_type", sa.Text(), nullable=False),
        sa.Column("sender_admin_id", UUID(as_uuid=True), sa.ForeignKey("admins.id")),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_message_conv_created", "messages", ["conversation_id", "created_at"])


def downgrade() -> None:
    op.drop_table("messages")
    op.drop_table("conversations")
