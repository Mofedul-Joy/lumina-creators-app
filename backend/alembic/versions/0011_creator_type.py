"""Add creator_type to creator_profiles.

The onboarding wizard opens with "What kind of creator are you?" (ugc /
influencer / both) — a lightweight signal for brands. Nullable, no default.

Revision ID: 0011_creator_type
Revises: 0010_payout_per_method
"""
from alembic import op
import sqlalchemy as sa

revision = "0011_creator_type"
down_revision = "0010_payout_per_method"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("creator_profiles", sa.Column("creator_type", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("creator_profiles", "creator_type")
