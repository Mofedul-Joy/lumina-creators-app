"""baseline

Revision ID: 0001_baseline
Revises:
Create Date: 2026-07-01

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


creator_status = postgresql.ENUM(
    "pending", "active", "suspended", name="creator_status", create_type=False
)
signup_source = postgresql.ENUM(
    "self", "admin_invite", "migrated", name="signup_source", create_type=False
)
admin_role = postgresql.ENUM("owner", "admin", "staff", name="admin_role", create_type=False)
client_status = postgresql.ENUM("active", "suspended", name="client_status", create_type=False)
gender = postgresql.ENUM(
    "male",
    "female",
    "non_binary",
    "other",
    "prefer_not_to_say",
    name="gender",
    create_type=False,
)
platform = postgresql.ENUM(
    "instagram", "tiktok", "youtube", "twitter", "facebook", name="platform", create_type=False
)
campaign_mode = postgresql.ENUM(
    "create_new", "copy_paste", name="campaign_mode", create_type=False
)
campaign_status = postgresql.ENUM(
    "draft", "active", "paused", "completed", "archived", name="campaign_status", create_type=False
)
participation_status = postgresql.ENUM(
    "joined",
    "submitted",
    "approved",
    "rejected",
    name="participation_status",
    create_type=False,
)
scrape_status = postgresql.ENUM(
    "pending", "success", "failed", name="scrape_status", create_type=False
)
scrape_job_status = postgresql.ENUM(
    "queued", "running", "success", "failed", name="scrape_job_status", create_type=False
)
verification_status = postgresql.ENUM(
    "pending", "verified", "rejected", name="verification_status", create_type=False
)
payout_method = postgresql.ENUM(
    "paypal", "solana", "whop", name="payout_method", create_type=False
)
payout_status = postgresql.ENUM(
    "requested", "processing", "paid", "failed", name="payout_status", create_type=False
)
storage_purpose = postgresql.ENUM(
    "avatar", "portfolio_video", "proof_video", name="storage_purpose", create_type=False
)
storage_status = postgresql.ENUM(
    "pending", "uploaded", "finalized", "rejected", name="storage_status", create_type=False
)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")

    op.execute("CREATE TYPE creator_status AS ENUM ('pending', 'active', 'suspended')")
    op.execute("CREATE TYPE signup_source AS ENUM ('self', 'admin_invite', 'migrated')")
    op.execute("CREATE TYPE admin_role AS ENUM ('owner', 'admin', 'staff')")
    op.execute("CREATE TYPE client_status AS ENUM ('active', 'suspended')")
    op.execute(
        "CREATE TYPE gender AS ENUM "
        "('male', 'female', 'non_binary', 'other', 'prefer_not_to_say')"
    )
    op.execute(
        "CREATE TYPE platform AS ENUM "
        "('instagram', 'tiktok', 'youtube', 'twitter', 'facebook')"
    )
    op.execute("CREATE TYPE campaign_mode AS ENUM ('create_new', 'copy_paste')")
    op.execute(
        "CREATE TYPE campaign_status AS ENUM "
        "('draft', 'active', 'paused', 'completed', 'archived')"
    )
    op.execute(
        "CREATE TYPE participation_status AS ENUM "
        "('joined', 'submitted', 'approved', 'rejected')"
    )
    op.execute("CREATE TYPE scrape_status AS ENUM ('pending', 'success', 'failed')")
    op.execute("CREATE TYPE scrape_job_status AS ENUM ('queued', 'running', 'success', 'failed')")
    op.execute("CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected')")
    op.execute("CREATE TYPE payout_method AS ENUM ('paypal', 'solana', 'whop')")
    op.execute("CREATE TYPE payout_status AS ENUM ('requested', 'processing', 'paid', 'failed')")
    op.execute(
        "CREATE TYPE storage_purpose AS ENUM ('avatar', 'portfolio_video', 'proof_video')"
    )
    op.execute(
        "CREATE TYPE storage_status AS ENUM ('pending', 'uploaded', 'finalized', 'rejected')"
    )

    op.create_table(
        "creators",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("email", postgresql.CITEXT(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column("status", creator_status, server_default=sa.text("'pending'"), nullable=False),
        sa.Column(
            "signup_source", signup_source, server_default=sa.text("'self'"), nullable=False
        ),
        sa.Column("email_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "signup_source <> 'self' OR password_hash IS NOT NULL",
            name="chk_self_signup_has_password",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    op.create_table(
        "admins",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("email", postgresql.CITEXT(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", admin_role, server_default=sa.text("'admin'"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    op.create_table(
        "clients",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("email", postgresql.CITEXT(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("status", client_status, server_default=sa.text("'active'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    op.create_table(
        "storage_objects",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("owner_creator_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("purpose", storage_purpose, nullable=False),
        sa.Column("bucket", sa.Text(), nullable=False),
        sa.Column("object_key", sa.Text(), nullable=False),
        sa.Column("content_type", sa.Text(), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("checksum_sha256", sa.Text(), nullable=True),
        sa.Column("status", storage_status, server_default=sa.text("'pending'"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["owner_creator_id"], ["creators.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("bucket", "object_key"),
    )
    op.create_index("idx_storage_owner", "storage_objects", ["owner_creator_id"])
    op.create_index("idx_storage_status", "storage_objects", ["status"])

    op.create_table(
        "creator_profiles",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=True),
        sa.Column("avatar_object_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", gender, nullable=True),
        sa.Column("ethnicity", sa.Text(), nullable=True),
        sa.Column("primary_language", sa.Text(), nullable=True),
        sa.Column(
            "languages",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("'{}'::text[]"),
            nullable=False,
        ),
        sa.Column("country", sa.Text(), nullable=True),
        sa.Column("city", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["avatar_object_id"], ["storage_objects.id"]),
        sa.ForeignKeyConstraint(["creator_id"], ["creators.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("creator_id"),
    )
    op.create_index("idx_profiles_gender", "creator_profiles", ["gender"])
    op.create_index("idx_profiles_country", "creator_profiles", ["country"])
    op.create_index("idx_profiles_city", "creator_profiles", ["city"])
    op.create_index("idx_profiles_dob", "creator_profiles", ["date_of_birth"])
    op.create_index("idx_profiles_ethnicity", "creator_profiles", ["ethnicity"])
    op.create_index("idx_profiles_language", "creator_profiles", ["primary_language"])
    op.create_index(
        "idx_profiles_languages", "creator_profiles", ["languages"], postgresql_using="gin"
    )
    op.create_index("idx_profiles_completed", "creator_profiles", ["completed_at"])

    op.create_table(
        "social_accounts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform", platform, nullable=False),
        sa.Column("handle", sa.Text(), nullable=False),
        sa.Column("profile_url", sa.Text(), nullable=True),
        sa.Column("follower_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("is_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("follower_count >= 0"),
        sa.ForeignKeyConstraint(["creator_id"], ["creators.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("creator_id", "platform", "handle"),
    )
    op.create_index("idx_social_creator", "social_accounts", ["creator_id"])
    op.create_index(
        "idx_social_platform_follows", "social_accounts", ["platform", "follower_count"]
    )

    op.create_table(
        "portfolio_items",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("storage_object_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("brand_name", sa.Text(), nullable=True),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("platform", platform, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["creator_id"], ["creators.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["storage_object_id"], ["storage_objects.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_portfolio_creator", "portfolio_items", ["creator_id"])

    op.create_table(
        "campaigns",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("mode", campaign_mode, nullable=False),
        sa.Column("status", campaign_status, server_default=sa.text("'draft'"), nullable=False),
        sa.Column("cpm_rate", sa.Numeric(12, 4), nullable=False),
        sa.Column("budget", sa.Numeric(14, 2), nullable=False),
        sa.Column("max_payout_per_creator", sa.Numeric(14, 2), nullable=True),
        sa.Column(
            "eligible_view_pct", sa.Numeric(5, 2), server_default=sa.text("100"), nullable=False
        ),
        sa.Column("min_retention_days", sa.Integer(), server_default=sa.text("30"), nullable=False),
        sa.Column("spent_amount", sa.Numeric(14, 2), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "platforms",
            postgresql.ARRAY(platform),
            server_default=sa.text("'{}'::platform[]"),
            nullable=False,
        ),
        sa.Column(
            "geo_countries",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("'{}'::text[]"),
            nullable=False,
        ),
        sa.Column("brief_script", sa.Text(), nullable=True),
        sa.Column("content_drive_url", sa.Text(), nullable=True),
        sa.Column("caption_rules", sa.Text(), nullable=True),
        sa.Column(
            "required_mentions",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("'{}'::text[]"),
            nullable=False,
        ),
        sa.Column(
            "example_captions",
            postgresql.ARRAY(sa.Text()),
            server_default=sa.text("'{}'::text[]"),
            nullable=False,
        ),
        sa.Column("requirements_url", sa.Text(), nullable=True),
        sa.Column("brand_name", sa.Text(), nullable=True),
        sa.Column("brand_logo_url", sa.Text(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("cpm_rate > 0"),
        sa.CheckConstraint("budget > 0"),
        sa.CheckConstraint("max_payout_per_creator IS NULL OR max_payout_per_creator > 0"),
        sa.CheckConstraint("eligible_view_pct BETWEEN 0 AND 100"),
        sa.CheckConstraint("min_retention_days >= 0"),
        sa.CheckConstraint("spent_amount >= 0"),
        sa.CheckConstraint(
            "(mode = 'create_new' AND brief_script IS NOT NULL AND btrim(brief_script) <> '' "
            "AND content_drive_url IS NULL) OR "
            "(mode = 'copy_paste' AND content_drive_url IS NOT NULL "
            "AND btrim(content_drive_url) <> '')",
            name="chk_mode_content",
        ),
        sa.CheckConstraint(
            "starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at", name="chk_dates"
        ),
        sa.CheckConstraint(
            "status = 'draft' OR array_length(platforms, 1) >= 1",
            name="chk_platforms_when_live",
        ),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["admins.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("idx_campaigns_status", "campaigns", ["status"])
    op.create_index("idx_campaigns_mode", "campaigns", ["mode"])
    op.create_index("idx_campaigns_client", "campaigns", ["client_id"])

    op.create_table(
        "campaign_participations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status", participation_status, server_default=sa.text("'joined'"), nullable=False
        ),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["creator_id"], ["creators.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("campaign_id", "creator_id"),
        sa.UniqueConstraint("id", "campaign_id", "creator_id"),
    )
    op.create_index("idx_part_campaign", "campaign_participations", ["campaign_id"])
    op.create_index("idx_part_creator", "campaign_participations", ["creator_id"])

    op.create_table(
        "submissions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("participation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("post_url", sa.Text(), nullable=False),
        sa.Column("canonical_url", sa.Text(), nullable=False),
        sa.Column("url_hash", sa.Text(), nullable=False),
        sa.Column("platform", platform, nullable=False),
        sa.Column("views", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("likes", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("comments", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("cpm_rate_snapshot", sa.Numeric(12, 4), nullable=False),
        sa.Column(
            "eligible_view_pct_snapshot",
            sa.Numeric(5, 2),
            server_default=sa.text("100"),
            nullable=False,
        ),
        sa.Column(
            "estimated_amount",
            sa.Numeric(14, 4),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("payable_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scrape_status", scrape_status, server_default=sa.text("'pending'"), nullable=False),
        sa.Column(
            "verification_status",
            verification_status,
            server_default=sa.text("'pending'"),
            nullable=False,
        ),
        sa.Column("verification_note", sa.Text(), nullable=True),
        sa.Column("verified_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("proof_object_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("embed_broken", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "post_unavailable", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_scraped_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("views >= 0"),
        sa.CheckConstraint("likes >= 0"),
        sa.CheckConstraint("comments >= 0"),
        sa.ForeignKeyConstraint(
            ["participation_id", "campaign_id", "creator_id"],
            [
                "campaign_participations.id",
                "campaign_participations.campaign_id",
                "campaign_participations.creator_id",
            ],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(["proof_object_id"], ["storage_objects.id"]),
        sa.ForeignKeyConstraint(["verified_by"], ["admins.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("campaign_id", "url_hash"),
    )
    op.create_index("idx_sub_creator", "submissions", ["creator_id"])
    op.create_index("idx_sub_campaign", "submissions", ["campaign_id"])
    op.create_index("idx_sub_scrape", "submissions", ["scrape_status"])
    op.create_index("idx_sub_verify", "submissions", ["verification_status"])

    op.create_table(
        "scrape_jobs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("submission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", scrape_job_status, server_default=sa.text("'queued'"), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("max_attempts", sa.Integer(), server_default=sa.text("5"), nullable=False),
        sa.Column("last_apify_run_id", sa.Text(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("submission_id"),
    )
    op.create_index("idx_scrape_due", "scrape_jobs", ["status", "next_run_at"])

    op.create_table(
        "payment_methods",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("method", payout_method, nullable=False),
        sa.Column("paypal_email", sa.Text(), nullable=True),
        sa.Column("solana_address", sa.Text(), nullable=True),
        sa.Column("whop_username", sa.Text(), nullable=True),
        sa.Column("is_default", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "(method = 'paypal' AND paypal_email IS NOT NULL AND solana_address IS NULL "
            "AND whop_username IS NULL) OR "
            "(method = 'solana' AND solana_address IS NOT NULL AND paypal_email IS NULL "
            "AND whop_username IS NULL) OR "
            "(method = 'whop' AND whop_username IS NOT NULL AND paypal_email IS NULL "
            "AND solana_address IS NULL)",
            name="chk_method_fields",
        ),
        sa.ForeignKeyConstraint(["creator_id"], ["creators.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_default_method_per_creator",
        "payment_methods",
        ["creator_id"],
        unique=True,
        postgresql_where=sa.text("is_default"),
    )

    op.create_table(
        "payouts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("method", payout_method, nullable=False),
        sa.Column("status", payout_status, server_default=sa.text("'requested'"), nullable=False),
        sa.Column(
            "idempotency_key",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("processed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("external_ref", sa.Text(), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("requested_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("amount > 0"),
        sa.ForeignKeyConstraint(["creator_id"], ["creators.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["processed_by"], ["admins.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("idx_payouts_creator", "payouts", ["creator_id"])
    op.create_index("idx_payouts_status", "payouts", ["status"])

    op.create_table(
        "payout_items",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("payout_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("submission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("amount > 0"),
        sa.ForeignKeyConstraint(["payout_id"], ["payouts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_active_payout_item",
        "payout_items",
        ["submission_id"],
        unique=True,
        postgresql_where=sa.text("voided_at IS NULL"),
    )
    op.create_index("idx_payout_items_payout", "payout_items", ["payout_id"])

    op.create_table(
        "refresh_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_type", sa.Text(), nullable=False),
        sa.Column("jti", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("ip", postgresql.INET(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("jti"),
    )
    op.create_index("idx_refresh_subject", "refresh_tokens", ["subject_type", "subject_id"])
    op.create_index("idx_refresh_expiry", "refresh_tokens", ["expires_at"])

    op.create_table(
        "audit_log",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("actor_admin_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("entity_type", sa.Text(), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_admin_id"], ["admins.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_audit_entity", "audit_log", ["entity_type", "entity_id"])
    op.create_index("idx_audit_actor", "audit_log", ["actor_admin_id"])


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("refresh_tokens")
    op.drop_table("payout_items")
    op.drop_table("payouts")
    op.drop_table("payment_methods")
    op.drop_table("scrape_jobs")
    op.drop_table("submissions")
    op.drop_table("campaign_participations")
    op.drop_table("campaigns")
    op.drop_table("portfolio_items")
    op.drop_table("social_accounts")
    op.drop_table("creator_profiles")
    op.drop_table("storage_objects")
    op.drop_table("clients")
    op.drop_table("admins")
    op.drop_table("creators")

    op.execute("DROP TYPE IF EXISTS storage_status")
    op.execute("DROP TYPE IF EXISTS storage_purpose")
    op.execute("DROP TYPE IF EXISTS payout_status")
    op.execute("DROP TYPE IF EXISTS payout_method")
    op.execute("DROP TYPE IF EXISTS verification_status")
    op.execute("DROP TYPE IF EXISTS scrape_job_status")
    op.execute("DROP TYPE IF EXISTS scrape_status")
    op.execute("DROP TYPE IF EXISTS participation_status")
    op.execute("DROP TYPE IF EXISTS campaign_status")
    op.execute("DROP TYPE IF EXISTS campaign_mode")
    op.execute("DROP TYPE IF EXISTS platform")
    op.execute("DROP TYPE IF EXISTS gender")
    op.execute("DROP TYPE IF EXISTS client_status")
    op.execute("DROP TYPE IF EXISTS admin_role")
    op.execute("DROP TYPE IF EXISTS signup_source")
    op.execute("DROP TYPE IF EXISTS creator_status")

    op.execute("DROP EXTENSION IF EXISTS citext")
    op.execute("DROP EXTENSION IF EXISTS pgcrypto")
