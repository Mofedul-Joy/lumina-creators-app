"""Social handle verification via the bio-code method (SideShift-style).

Flow:
  1. start_verification(): creator gives a platform + handle. We upsert an
     (unverified) SocialAccount and stamp it with a short code like "LC-F9RJK2".
     The creator pastes that code into their platform bio.
  2. confirm_verification(): we scrape the account's bio through Apify and, if
     the code is present, flip is_verified and pull the real follower count.

No third-party OAuth/approval needed — it reuses the same Apify integration that
powers view-scraping. Locally (no APIFY_API_TOKEN, non-production) confirm falls
back to auto-verify so the UI flow is testable end to end.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.integrations import apify
from app.models.profile import SocialAccount
from app.services import profile as profile_svc
from app.services import urls

VERIFIABLE_PLATFORMS = {"instagram", "tiktok"}
CODE_TTL_MINUTES = 30
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous 0/O/1/I


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _gen_code() -> str:
    return "LC-" + "".join(secrets.choice(_CODE_ALPHABET) for _ in range(6))


def _clean_handle(handle: str) -> str:
    h = (handle or "").strip().lstrip("@").strip()
    if not h:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Handle is required")
    return h


def _get_or_create(db: Session, creator_id: uuid.UUID, platform: str, handle: str) -> SocialAccount:
    social = db.scalar(
        select(SocialAccount).where(
            SocialAccount.creator_id == creator_id,
            SocialAccount.platform == platform,
            SocialAccount.handle == handle,
        )
    )
    if social is None:
        social = SocialAccount(
            creator_id=creator_id,
            platform=platform,
            handle=handle,
            profile_url=urls.social_profile_url(platform, handle),
        )
        db.add(social)
    return social


def start_verification(db: Session, creator_id: uuid.UUID, platform: str, handle: str) -> dict:
    if platform not in VERIFIABLE_PLATFORMS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{platform} verification isn't supported")
    handle = _clean_handle(handle)
    social = _get_or_create(db, creator_id, platform, handle)
    # Keep an existing, still-valid code stable so a page refresh doesn't change
    # the code a creator already pasted into their bio.
    if not (social.verification_code and social.verification_code_expires_at
            and social.verification_code_expires_at > _now() and not social.is_verified):
        social.verification_code = _gen_code()
        social.verification_code_expires_at = _now() + timedelta(minutes=CODE_TTL_MINUTES)
        social.is_verified = False
    db.commit()
    db.refresh(social)
    return {
        "platform": platform,
        "handle": handle,
        "code": social.verification_code,
        "expires_at": social.verification_code_expires_at,
        "instructions": (
            f"Add {social.verification_code} anywhere in your {platform} bio, then tap Verify. "
            "You can remove it once verified."
        ),
    }


def confirm_verification(db: Session, creator_id: uuid.UUID, platform: str, handle: str) -> SocialAccount:
    if platform not in VERIFIABLE_PLATFORMS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{platform} verification isn't supported")
    handle = _clean_handle(handle)
    social = db.scalar(
        select(SocialAccount).where(
            SocialAccount.creator_id == creator_id,
            SocialAccount.platform == platform,
            SocialAccount.handle == handle,
        )
    )
    if social is None or not social.verification_code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Start verification first to get a code.")
    if social.is_verified:
        return social
    if social.verification_code_expires_at and social.verification_code_expires_at < _now():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your code expired. Tap 'Get a new code' and try again.")

    settings = get_settings()
    code = social.verification_code

    if not settings.apify_configured:
        if settings.is_production:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Verification is temporarily unavailable.")
        # Dev fallback: no scraper wired up locally — trust the code so the flow
        # is testable. NEVER reached in production (guarded above).
        return _mark_verified(db, social, followers=social.follower_count, profile_url=social.profile_url)

    try:
        info = apify.scrape_profile(platform, handle)
    except apify.ApifyNotConfigured:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Verification is temporarily unavailable.")
    except Exception:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Couldn't reach your profile. Try again in a moment.")

    if info is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"Couldn't find @{handle} on {platform}. Check the handle and that your profile is public.",
        )
    if _norm(code) not in _norm(info.bio):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"We didn't find {code} in your {platform} bio yet. Save it in your bio and try again.",
        )
    return _mark_verified(
        db, social,
        followers=info.followers or social.follower_count,
        profile_url=social.profile_url,
    )


def _mark_verified(db: Session, social: SocialAccount, *, followers: int, profile_url: str | None) -> SocialAccount:
    social.is_verified = True
    social.follower_count = max(followers or 0, 0)
    social.profile_url = profile_url or social.profile_url
    social.last_synced_at = _now()
    social.verification_code = None
    social.verification_code_expires_at = None
    db.commit()
    db.refresh(social)
    profile_svc.recompute_completion(db, social.creator_id)
    return social


def _norm(s: str) -> str:
    """Case/space-insensitive compare so 'lc-f9rjk2' in a bio still matches."""
    return "".join((s or "").split()).upper()


# ── Apply-eligibility gate (used by join_campaign) ────────────────────────────
# Separate from recompute_completion() (which is an incentive, not a gate). A
# creator must have a name and at least one social account on file before they
# can apply to a campaign — mirrors SideShift's "complete your profile" wall.
def apply_eligibility(db: Session, creator_id: uuid.UUID) -> tuple[bool, list[str]]:
    prof = profile_svc.get_or_create_profile(db, creator_id)
    socials = profile_svc.list_socials(db, creator_id)
    missing: list[str] = []
    if not (prof.display_name or "").strip():
        missing.append("your name")
    if not socials:
        missing.append("at least one social account")
    return (not missing), missing
