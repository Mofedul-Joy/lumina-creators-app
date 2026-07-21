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
from typing import Optional

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
    h = (handle or "").strip().lstrip("@").strip().lower()
    if not h:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Handle is required")
    return h


def _resolve_social(db: Session, creator_id: uuid.UUID, platform: str, handle: str) -> SocialAccount:
    """One row per (creator, platform, HANDLE) — supports MULTIPLE accounts per
    platform (Bill: more than one Instagram/TikTok/etc.). Find the exact handle
    and reuse it, else create a new row. NEVER deletes the creator's other
    accounts on the same platform (the old 'one per platform' collapse blocked
    adding a second account)."""
    social = db.scalar(
        select(SocialAccount).where(
            SocialAccount.creator_id == creator_id,
            SocialAccount.platform == platform,
            SocialAccount.handle == handle,
        )
    )
    if social is None:
        social = SocialAccount(
            creator_id=creator_id, platform=platform, handle=handle,
            profile_url=urls.social_profile_url(platform, handle),
        )
        db.add(social)
    return social


def start_verification(db: Session, creator_id: uuid.UUID, platform: str, handle: str) -> dict:
    if platform not in VERIFIABLE_PLATFORMS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{platform} verification isn't supported")
    handle = _clean_handle(handle)
    social = _resolve_social(db, creator_id, platform, handle)

    # Already verified → no-op. NEVER re-issue a code or clear is_verified here
    # (that was the bug that "un-verified" a creator when the step re-rendered).
    if social.is_verified:
        db.commit()
        db.refresh(social)
        return {
            "platform": platform, "handle": social.handle, "code": None, "expires_at": None,
            "already_verified": True,
            "instructions": f"Your {platform} @{social.handle} is already verified.",
        }

    # Reuse a still-valid code so a refresh doesn't change what they pasted in bio.
    if not (social.verification_code and social.verification_code_expires_at
            and social.verification_code_expires_at > _now()):
        social.verification_code = _gen_code()
        social.verification_code_expires_at = _now() + timedelta(minutes=CODE_TTL_MINUTES)
    db.commit()
    db.refresh(social)
    return {
        "platform": platform,
        "handle": handle,
        "code": social.verification_code,
        "expires_at": social.verification_code_expires_at,
        "already_verified": False,
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
    # Already verified → success no-op. This MUST come before the missing-code
    # check: verifying clears verification_code, so an already-verified account
    # has code=None and would otherwise trip the false "Start verification
    # first" error when Verify is tapped again / the page re-submits.
    if social is not None and social.is_verified:
        return social
    if social is None or not social.verification_code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Start verification first to get a code.")
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
# A creator must have a FULLY complete profile — About, Socials (>=1 verified),
# Videos, Details, Payment — before they can apply to a campaign. Returns
# (is_complete, next_section) where next_section is where the popup should route.
def apply_eligibility(db: Session, creator_id: uuid.UUID) -> tuple[bool, Optional[str]]:
    c = profile_svc.profile_completeness(db, creator_id)
    return c["complete"], c["next_section"]
