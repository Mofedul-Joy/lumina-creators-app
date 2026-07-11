"""Notifications + campaign invites.

Two tables behind the admin "Add creators" flow:

* `notifications` — the creator-facing bell feed. A campaign invite to an
  existing creator drops one row here with a clickable `link` to the campaign.
* `campaign_invites` — an invite to ONE campaign, for either an existing creator
  (`creator_id` set → delivered as a notification + email) or an outsider
  (`email` + `token` set → emailed a `/signup?invite=<token>` link that
  auto-joins the campaign on signup). A link-only invite (both null) backs the
  shareable "Copy invite link".

Revision ID: 0026_notify_invites
Revises: 0025_top_videos
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0026_notify_invites"
down_revision: Union[str, None] = "0025_top_videos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True),
                  server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("creator_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("creators.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False, server_default="general"),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("link", sa.Text(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    # Feed query: newest-first per creator; unread badge counts read_at IS NULL.
    op.create_index("idx_notif_creator_created", "notifications", ["creator_id", "created_at"])

    op.create_table(
        "campaign_invites",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True),
                  server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("campaign_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("creator_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("creators.id", ondelete="CASCADE"), nullable=True),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("token", sa.Text(), nullable=True, unique=True),
        sa.Column("created_by_admin_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("admins.id", ondelete="SET NULL"), nullable=True),
        sa.Column("email_sent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_creator_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("creators.id", ondelete="SET NULL"), nullable=True),
        sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_cinvite_campaign", "campaign_invites", ["campaign_id"])
    op.create_index("idx_cinvite_creator", "campaign_invites", ["creator_id"])
    # At most one OPEN (not accepted / declined / revoked) invite per existing
    # creator per campaign — re-inviting an already-pending creator is a no-op.
    op.create_index(
        "uq_cinvite_open_creator", "campaign_invites", ["campaign_id", "creator_id"],
        unique=True,
        postgresql_where=sa.text("creator_id IS NOT NULL AND accepted_at IS NULL "
                                 "AND declined_at IS NULL AND revoked_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_cinvite_open_creator", table_name="campaign_invites")
    op.drop_index("idx_cinvite_creator", table_name="campaign_invites")
    op.drop_index("idx_cinvite_campaign", table_name="campaign_invites")
    op.drop_table("campaign_invites")
    op.drop_index("idx_notif_creator_created", table_name="notifications")
    op.drop_table("notifications")
