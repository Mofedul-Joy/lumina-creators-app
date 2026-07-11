"""Campaign Participation Agreements (contracts).

Two tables:

* `campaign_contracts` — one editable template per campaign (full free-text body
  with {{merge tokens}}), seeded from a default on campaign creation and editable
  by the admin via "Edit contract".
* `creator_contracts` — one generated instance per creator per campaign, created
  when the creator joins. `rendered_body` is an immutable snapshot of the merged
  agreement at generation time, so later template edits never alter a contract
  already sent/accepted. `document_id` is the public reference in the URL/PDF.

Revision ID: 0027_contracts
Revises: 0026_notify_invites
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision: str = "0027_contracts"
down_revision: Union[str, None] = "0026_notify_invites"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "campaign_contracts",
        sa.Column("id", pg.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("campaign_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("title", sa.Text(), nullable=False, server_default="Campaign Participation Agreement"),
        sa.Column("subtitle", sa.Text(), nullable=False,
                  server_default="Independent Contractor Agreement for Creator Engagement"),
        sa.Column("company_name", sa.Text(), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("updated_by_admin_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("admins.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "creator_contracts",
        sa.Column("id", pg.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("campaign_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("creator_id", pg.UUID(as_uuid=True),
                  sa.ForeignKey("creators.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.Text(), nullable=False, unique=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("subtitle", sa.Text(), nullable=False, server_default=""),
        sa.Column("company_name", sa.Text(), nullable=False, server_default=""),
        sa.Column("rendered_body", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="sent"),  # sent|viewed|accepted|declined
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("viewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_name", sa.Text(), nullable=True),
        sa.Column("accepted_ip", pg.INET(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("campaign_id", "creator_id", name="uq_creator_contract"),
    )
    op.create_index("idx_creator_contract_creator", "creator_contracts", ["creator_id"])
    op.create_index("idx_creator_contract_campaign", "creator_contracts", ["campaign_id"])


def downgrade() -> None:
    op.drop_index("idx_creator_contract_campaign", table_name="creator_contracts")
    op.drop_index("idx_creator_contract_creator", table_name="creator_contracts")
    op.drop_table("creator_contracts")
    op.drop_table("campaign_contracts")
