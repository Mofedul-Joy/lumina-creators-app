"""Add creator_profiles.onboarding jsonb for SideShift-style onboarding answers.

Stores the extra personalization the granular onboarding flow collects that
don't warrant dedicated columns (ugc_experience, experience_level,
content_types, posts_per_day, hours_per_week, how_heard, referral_code).

Revision ID: 0038_profile_onboarding
Revises: 0037_drop_old_cpm_check
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0038_profile_onboarding"
down_revision: Union[str, None] = "0037_drop_old_cpm_check"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "creator_profiles",
        sa.Column("onboarding", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )


def downgrade() -> None:
    op.drop_column("creator_profiles", "onboarding")
