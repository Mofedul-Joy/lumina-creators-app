"""Creator removal — soft-remove from campaigns, optionally stop tracking.

`payouts` and `campaign_participations` are ON DELETE RESTRICT against creators
(financial integrity, CONTEXT.md rule 5), and submissions hang off participation
rows. So removal is expressed as state, not deletion: a removed participation is
marked rather than dropped, and a creator whose ledger must survive is scrubbed
and tombstoned rather than hard-deleted.

Revision ID: 0022_creator_removal
Revises: 0021_creator_invites
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0022_creator_removal"
down_revision: Union[str, None] = "0021_creator_invites"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Removed from a campaign without dropping the row a submission points at.
    op.add_column(
        "campaign_participations",
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
    )
    # When set, existing posts keep earning but the creator can't submit new ones.
    op.add_column(
        "creators",
        sa.Column("tracking_disabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("creators", sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True))
    # delete_all | keep_analytics | keep_posts — what the admin chose.
    op.add_column("creators", sa.Column("removal_mode", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("creators", "removal_mode")
    op.drop_column("creators", "removed_at")
    op.drop_column("creators", "tracking_disabled")
    op.drop_column("campaign_participations", "removed_at")
