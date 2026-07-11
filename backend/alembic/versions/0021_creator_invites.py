"""Creator invites — email invite + shareable join link.

One row per invite. `email` is optional: an invite with no email is a generic
shareable link the admin hands out; one with an email also gets a message sent to
it. Accepting is what links the invite to the creator it produced.

Revision ID: 0021_creator_invites
Revises: 0020_creator_phone
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0021_creator_invites"
down_revision: Union[str, None] = "0020_creator_phone"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "creator_invites",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")
        ),
        sa.Column("token", sa.Text(), nullable=False, unique=True),
        # NULL = a generic shareable link rather than an invite to one address.
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column(
            "created_by_admin_id",
            UUID(as_uuid=True),
            sa.ForeignKey("admins.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("email_sent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "accepted_creator_id",
            UUID(as_uuid=True),
            sa.ForeignKey("creators.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("idx_invites_token", "creator_invites", ["token"])


def downgrade() -> None:
    op.drop_index("idx_invites_token", table_name="creator_invites")
    op.drop_table("creator_invites")
