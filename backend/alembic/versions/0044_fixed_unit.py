"""Fixed campaigns pay per deliverable, labelled as post or video.

Adds campaigns.fixed_unit ('post' | 'video'). When payment_type is 'fixed' this
tells the UI whether to say "per post" or "per video"; the payout math is the
same either way (a submission is one post = one video), so this is purely the
label the admin chose. Nullable: existing fixed campaigns and every other
payment type leave it null.

Revision ID: 0044
Revises: 0043
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0044"
down_revision: Union[str, None] = "0043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("campaigns", sa.Column("fixed_unit", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("campaigns", "fixed_unit")
