"""Campaign creation flow: kind, experience level, schedule + payout settings.

The new builder asks what KIND of campaign this is (high-volume UGC, influencer,
paid ads, campaign manager, analytics-only) and how much setup the admin wants
(essentials vs advanced), then collects a payment schedule and payout rules that
had nowhere to live.

Duration stays on the existing starts_at/ends_at — an "ongoing" campaign is
simply ends_at IS NULL, so there's no redundant boolean to disagree with it.

Revision ID: 0024_campaign_flow
Revises: 0023_view_snapshots
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024_campaign_flow"
down_revision: Union[str, None] = "0023_view_snapshots"
branch_labels = None
depends_on = None

KINDS = ("high_volume_ugc", "influencer", "paid_ads", "campaign_manager", "analytics_only")
LEVELS = ("essentials", "advanced")


def upgrade() -> None:
    op.add_column(
        "campaigns",
        sa.Column("campaign_kind", sa.Text(), nullable=False, server_default="high_volume_ugc"),
    )
    op.add_column(
        "campaigns",
        sa.Column("experience_level", sa.Text(), nullable=False, server_default="essentials"),
    )
    # Pay creators without tracking platform stats at all (the "No Platform
    # Tracking" toggle) — a fixed/per-post campaign doesn't need view counts.
    op.add_column(
        "campaigns",
        sa.Column("no_platform_tracking", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # every_7_days | every_14_days | every_30_days
    op.add_column(
        "campaigns",
        sa.Column("payment_schedule", sa.Text(), nullable=True),
    )
    # post_delivery | schedule — what starts a payment cycle.
    op.add_column(
        "campaigns",
        sa.Column("payment_cycle_trigger", sa.Text(), nullable=False, server_default="post_delivery"),
    )
    op.add_column(
        "campaigns",
        sa.Column("pro_rata", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    # Floor a post must clear before it earns ("Minimum Views"). NULL = no minimum.
    op.add_column("campaigns", sa.Column("min_views", sa.Integer(), nullable=True))
    # "$1,000 every N posts" — how many posts one recurring payment covers.
    op.add_column(
        "campaigns",
        sa.Column("posts_per_payment", sa.Integer(), nullable=False, server_default="1"),
    )

    op.create_check_constraint("chk_campaign_kind", "campaigns", sa.column("campaign_kind").in_(KINDS))
    op.create_check_constraint(
        "chk_campaign_experience", "campaigns", sa.column("experience_level").in_(LEVELS)
    )
    op.create_check_constraint(
        "chk_posts_per_payment_positive", "campaigns", sa.text("posts_per_payment >= 1")
    )


def downgrade() -> None:
    op.drop_constraint("chk_posts_per_payment_positive", "campaigns", type_="check")
    op.drop_constraint("chk_campaign_experience", "campaigns", type_="check")
    op.drop_constraint("chk_campaign_kind", "campaigns", type_="check")
    for col in (
        "posts_per_payment", "min_views", "pro_rata", "payment_cycle_trigger",
        "payment_schedule", "no_platform_tracking", "experience_level", "campaign_kind",
    ):
        op.drop_column("campaigns", col)
