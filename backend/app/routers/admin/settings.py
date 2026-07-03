"""Admin settings: a read-only view of the deployed platform configuration.

These are set via environment on Render (single source of truth); the console
surfaces them so the owner can see how the platform is running. Editable
per-tenant settings would need a settings table — deferred until needed.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.deps import get_current_admin
from app.models import Admin

router = APIRouter(prefix="/settings", tags=["admin-settings"])


class PlatformSettings(BaseModel):
    environment: str
    email_verification_required: bool
    email_provider: str          # resend | smtp | none
    payout_methods: list[str]
    campaign_modes: list[str]
    storage: str                 # r2 | local (proxy)


@router.get("", response_model=PlatformSettings)
def settings(admin: Admin = Depends(get_current_admin)):
    s = get_settings()
    provider = "resend" if s.resend_api_key else ("smtp" if s.smtp_configured else "none")
    storage = "r2" if getattr(s, "r2_bucket", "") else "local"
    return PlatformSettings(
        environment=s.environment,
        email_verification_required=s.require_email_verification and s.email_configured,
        email_provider=provider,
        payout_methods=["paypal", "solana", "whop"],
        campaign_modes=["create_new", "copy_paste"],
        storage=storage,
    )
