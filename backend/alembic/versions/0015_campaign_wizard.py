"""6-step campaign builder wizard (Feature 3, SideShift-style — BUILD_SPEC.md
§3.3) — adds job type / creator type / payment-type fields, targeting fields,
example videos, banner_url to campaigns, and a new campaign_bonus_milestones
table for repeatable views-threshold bonuses.

Existing check constraints (`cpm_rate > 0`, `budget > 0`, `chk_mode_content`)
are untouched — the wizard always sends `mode='create_new'` with a populated
`brief_script` and positive cpm_rate/budget (fallbacks applied client-side).

Revision ID: 0015_campaign_wizard
Revises: 0014_creator_gamification_and_richer_media
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, UUID

revision: str = "0015_campaign_wizard"
down_revision: Union[str, None] = "0014_creator_gamification_and_richer_media"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── campaigns: job/creator type + 5-way payment type fields ────────────────
    op.add_column("campaigns", sa.Column("job_type", sa.Text(), nullable=True))
    op.add_column("campaigns", sa.Column("creator_type", sa.Text(), nullable=True))
    op.add_column("campaigns", sa.Column("payment_type", sa.Text(), nullable=True))
    op.add_column("campaigns", sa.Column("fixed_amount", sa.Numeric(14, 2), nullable=True))
    op.add_column("campaigns", sa.Column("weekly_hours_needed", sa.Integer(), nullable=True))
    op.add_column("campaigns", sa.Column("hourly_rate", sa.Numeric(14, 2), nullable=True))
    op.add_column("campaigns", sa.Column("required_hours", sa.Integer(), nullable=True))
    op.add_column("campaigns", sa.Column("per_post_amount", sa.Numeric(14, 2), nullable=True))

    # ── example videos (step 4, up to 3) ────────────────────────────────────────
    op.add_column(
        "campaigns",
        sa.Column(
            "example_videos", ARRAY(sa.Text()), nullable=False, server_default=sa.text("'{}'::text[]")
        ),
    )

    # ── advanced targeting (step 5) ─────────────────────────────────────────────
    op.add_column("campaigns", sa.Column("age_requirement", sa.Text(), nullable=True))
    op.add_column(
        "campaigns",
        sa.Column(
            "platform_focus", ARRAY(sa.Text()), nullable=False, server_default=sa.text("'{}'::text[]")
        ),
    )
    op.add_column("campaigns", sa.Column("content_type", sa.Text(), nullable=True))
    op.add_column("campaigns", sa.Column("posting_frequency", sa.Text(), nullable=True))
    op.add_column("campaigns", sa.Column("video_length", sa.Text(), nullable=True))
    op.add_column("campaigns", sa.Column("account_type", sa.Text(), nullable=True))
    op.add_column(
        "campaigns",
        sa.Column("is_app", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "campaigns",
        sa.Column("physical_product", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    # ── banner (step 6) ──────────────────────────────────────────────────────────
    op.add_column("campaigns", sa.Column("banner_url", sa.Text(), nullable=True))

    # ── campaign_bonus_milestones (step 3, repeatable) ──────────────────────────
    op.create_table(
        "campaign_bonus_milestones",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "campaign_id",
            UUID(as_uuid=True),
            sa.ForeignKey("campaigns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("views_threshold", sa.Integer(), nullable=False),
        sa.Column("bonus_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.create_index(
        "idx_bonus_milestones_campaign", "campaign_bonus_milestones", ["campaign_id"]
    )


def downgrade() -> None:
    op.drop_index("idx_bonus_milestones_campaign", table_name="campaign_bonus_milestones")
    op.drop_table("campaign_bonus_milestones")

    op.drop_column("campaigns", "banner_url")
    op.drop_column("campaigns", "physical_product")
    op.drop_column("campaigns", "is_app")
    op.drop_column("campaigns", "account_type")
    op.drop_column("campaigns", "video_length")
    op.drop_column("campaigns", "posting_frequency")
    op.drop_column("campaigns", "content_type")
    op.drop_column("campaigns", "platform_focus")
    op.drop_column("campaigns", "age_requirement")

    op.drop_column("campaigns", "example_videos")

    op.drop_column("campaigns", "per_post_amount")
    op.drop_column("campaigns", "required_hours")
    op.drop_column("campaigns", "hourly_rate")
    op.drop_column("campaigns", "weekly_hours_needed")
    op.drop_column("campaigns", "fixed_amount")
    op.drop_column("campaigns", "payment_type")
    op.drop_column("campaigns", "creator_type")
    op.drop_column("campaigns", "job_type")
