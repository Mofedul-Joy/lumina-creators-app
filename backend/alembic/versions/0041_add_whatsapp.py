"""Add creator profile WhatsApp number.

Revision ID: 0041
Revises: 0040_verify_pending_subs
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0041"
down_revision: Union[str, None] = "0040_verify_pending_subs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("creator_profiles", sa.Column("whatsapp", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("creator_profiles", "whatsapp")
