"""Backfill participation status: joined -> accepted for auto-accepted rows.

Rev2 made joining a campaign auto-accept (sets accepted_at) but left the
participation `status` enum at its default "joined". That desynced the admin
Applicants pipeline (auto-accepted creators showed under "New" instead of
"Accepted"). join_campaign now sets status="accepted" for new joins; this
one-time backfill fixes existing rows that predate that change.

Only rows that are genuinely accepted and still active are touched:
accepted_at IS NOT NULL AND removed_at IS NULL. Rows an admin later advanced
(submitted/approved/rejected/reviewed/messaged/declined) are left untouched.

Revision ID: 0039_backfill_accepted_status
Revises: 0038_profile_onboarding
"""
from typing import Union

from alembic import op

revision: str = "0039_backfill_accepted_status"
down_revision: Union[str, None] = "0038_profile_onboarding"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE campaign_participations
        SET status = 'accepted'
        WHERE status = 'joined'
          AND accepted_at IS NOT NULL
          AND removed_at IS NULL
        """
    )


def downgrade() -> None:
    # One-way data backfill — no meaningful downgrade (we can't tell which
    # 'accepted' rows were originally 'joined'). No-op.
    pass
