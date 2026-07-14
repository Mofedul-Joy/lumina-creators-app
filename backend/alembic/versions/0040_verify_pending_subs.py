"""Backfill: auto-approve legacy 'pending' submissions.

Bill's no-review model auto-verifies submissions on create, but rows created
before that cutover sit at verification_status='pending' forever — and the
scrape worker only scrapes verified rows, so they never earn/get views. Flip
them to 'verified' (their ScrapeJob rows already exist and are past next_run_at,
so the worker picks them up on the next tick). Only 'pending' is touched;
'rejected' rows an admin explicitly declined are left as-is.

Revision ID: 0040_verify_pending_subs
Revises: 0039_backfill_accepted_status
"""
from typing import Union

from alembic import op

revision: str = "0040_verify_pending_subs"
down_revision: Union[str, None] = "0039_backfill_accepted_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE submissions
        SET verification_status = 'verified',
            verified_at = COALESCE(verified_at, now())
        WHERE verification_status = 'pending'
        """
    )


def downgrade() -> None:
    # One-way backfill — we can't tell which 'verified' rows were originally
    # 'pending'. No-op.
    pass
