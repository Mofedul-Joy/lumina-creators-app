from __future__ import annotations

from sqlalchemy import Enum


CREATOR_STATUS = Enum(
    "pending",
    "active",
    "suspended",
    name="creator_status",
    native_enum=True,
    create_type=False,
)
SIGNUP_SOURCE = Enum(
    "self",
    "admin_invite",
    "migrated",
    "public_submit",
    name="signup_source",
    native_enum=True,
    create_type=False,
)
ADMIN_ROLE = Enum(
    "owner",
    "admin",
    "staff",
    name="admin_role",
    native_enum=True,
    create_type=False,
)
CLIENT_STATUS = Enum(
    "active",
    "suspended",
    name="client_status",
    native_enum=True,
    create_type=False,
)
GENDER = Enum(
    "male",
    "female",
    "non_binary",
    "other",
    "prefer_not_to_say",
    name="gender",
    native_enum=True,
    create_type=False,
)
PLATFORM = Enum(
    "instagram",
    "tiktok",
    "youtube",
    "twitter",
    "facebook",
    name="platform",
    native_enum=True,
    create_type=False,
)
CAMPAIGN_MODE = Enum(
    "create_new",
    "copy_paste",
    name="campaign_mode",
    native_enum=True,
    create_type=False,
)
CAMPAIGN_STATUS = Enum(
    "draft",
    "active",
    "paused",
    "completed",
    "archived",
    name="campaign_status",
    native_enum=True,
    create_type=False,
)
PARTICIPATION_STATUS = Enum(
    "joined",
    "submitted",
    "approved",
    "rejected",
    name="participation_status",
    native_enum=True,
    create_type=False,
)
SCRAPE_STATUS = Enum(
    "pending",
    "success",
    "failed",
    name="scrape_status",
    native_enum=True,
    create_type=False,
)
SCRAPE_JOB_STATUS = Enum(
    "queued",
    "running",
    "success",
    "failed",
    name="scrape_job_status",
    native_enum=True,
    create_type=False,
)
VERIFICATION_STATUS = Enum(
    "pending",
    "verified",
    "rejected",
    name="verification_status",
    native_enum=True,
    create_type=False,
)
PAYOUT_METHOD = Enum(
    "paypal",
    "solana",
    "whop",
    name="payout_method",
    native_enum=True,
    create_type=False,
)
PAYOUT_STATUS = Enum(
    "requested",
    "processing",
    "paid",
    "failed",
    name="payout_status",
    native_enum=True,
    create_type=False,
)
STORAGE_PURPOSE = Enum(
    "avatar",
    "portfolio_video",
    "proof_video",
    name="storage_purpose",
    native_enum=True,
    create_type=False,
)
STORAGE_STATUS = Enum(
    "pending",
    "uploaded",
    "finalized",
    "rejected",
    name="storage_status",
    native_enum=True,
    create_type=False,
)
