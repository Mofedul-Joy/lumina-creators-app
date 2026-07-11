"""Creator phone number.

The admin creator export carries a phone column (SideShift parity) and there was
nowhere to store one, so it would always have exported blank. Optional — most
creators sign up without it.

Revision ID: 0020_creator_phone
Revises: 0019_experience_kind
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0020_creator_phone"
down_revision: Union[str, None] = "0019_experience_kind"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("creator_profiles", sa.Column("phone", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("creator_profiles", "phone")
