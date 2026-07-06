"""Add education to creator_profiles.

The onboarding wizard's "Where are you in your education?" step (mirrors
SideShift). Nullable, no default.

Revision ID: 0012_creator_education
Revises: 0011_creator_type
"""
from alembic import op
import sqlalchemy as sa

revision = "0012_creator_education"
down_revision = "0011_creator_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("creator_profiles", sa.Column("education", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("creator_profiles", "education")
