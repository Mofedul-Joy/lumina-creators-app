"""Creator profile logic. Completion is SERVER-OWNED — only recompute_completion()
sets creator_profiles.completed_at. Never trust a client value for it."""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import _now
from app.models import CreatorExperience, CreatorProfile, PortfolioItem, SocialAccount, StorageObject
from app.services import geo, urls


def _require_owned_object(db: Session, creator_id: uuid.UUID, object_id, purpose: str) -> StorageObject:
    """Guard against IDOR: a storage object may only be attached by its owner,
    must be finalized, and must match the expected purpose."""
    try:
        oid = object_id if isinstance(object_id, uuid.UUID) else uuid.UUID(str(object_id))
    except (ValueError, TypeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid storage object id")
    obj = db.get(StorageObject, oid)
    if obj is None or obj.owner_creator_id != creator_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upload not found")
    if obj.purpose != purpose:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload has the wrong purpose")
    if obj.status != "finalized":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload is not finalized yet")
    return obj

_PLATFORMS = {"instagram", "tiktok", "youtube", "twitter", "facebook"}
_GENDERS = {"male", "female", "non_binary", "other", "prefer_not_to_say"}
_PAYOUT_METHODS = {"paypal", "solana", "whop"}
_CREATOR_TYPES = {"ugc", "influencer", "both"}
_EDUCATION = {"in_high_school", "in_college", "graduated", "grad_school", "no_college", "na"}
# Nothing is mandatory — demographics (DOB/gender/country/ethnicity/language)
# and socials/portfolio are dashboard incentives, not a signup gate. Kept as a
# tuple (not deleted outright) since recompute_completion() still reports
# `completed`/`missing` for the UI to show encouragement copy against.
# Keep GET /profile's `completed` flag in lockstep with the join gate
# (profile_completeness): both require creator_type + >=1 social + >=1 video, so
# a profile that reads "complete" can actually join. Fields the join gate checks
# via portfolio/social counts are added in recompute_completion below.
_REQUIRED_FIELDS: tuple[str, ...] = ("creator_type",)


def get_or_create_profile(db: Session, creator_id: uuid.UUID) -> CreatorProfile:
    prof = db.scalar(select(CreatorProfile).where(CreatorProfile.creator_id == creator_id))
    if prof is None:
        prof = CreatorProfile(creator_id=creator_id)
        db.add(prof)
        db.commit()
        db.refresh(prof)
    return prof


def update_profile(db: Session, creator_id: uuid.UUID, data: dict) -> CreatorProfile:
    prof = get_or_create_profile(db, creator_id)
    if data.get("gender") is not None and data["gender"] not in _GENDERS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid gender")
    if data.get("payout_method") not in (None, "") and data["payout_method"] not in _PAYOUT_METHODS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid payout method")
    if data.get("creator_type") not in (None, "") and data["creator_type"] not in _CREATOR_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid creator type")
    if data.get("education") not in (None, "") and data["education"] not in _EDUCATION:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid education")
    # Real-place validation — no made-up country/city.
    if data.get("country") not in (None, "") and not geo.is_valid_country(data["country"]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Please choose a real country from the list.")
    if data.get("city") not in (None, ""):
        country_for_city = data.get("country") or prof.country
        if country_for_city and not geo.city_exists(data["city"].strip(), country_for_city):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"We couldn't find “{data['city'].strip()}” in {country_for_city}. Enter a real city.",
            )
    if data.get("avatar_object_id") is not None:
        _require_owned_object(db, creator_id, data["avatar_object_id"], "avatar")
    for field in ("display_name", "phone", "creator_type", "bio", "date_of_birth", "gender", "ethnicity", "education",
                  "primary_language", "country", "city", "avatar_object_id",
                  "payout_method", "payout_address",
                  "payout_paypal", "payout_solana", "payout_whop"):
        if field in data:
            setattr(prof, field, data[field])
    if "languages" in data:
        prof.languages = data["languages"]
    # Keep payout_address as the resolved address for the selected method so
    # the admin payout prefill + claim gate (which read payout_address) stay
    # correct regardless of which per-method field the creator just edited.
    if prof.payout_method in _PAYOUT_METHODS:
        resolved = getattr(prof, f"payout_{prof.payout_method}", None)
        if resolved:
            prof.payout_address = resolved
    db.commit()
    recompute_completion(db, creator_id)
    return prof


# ---- socials ----
def list_socials(db: Session, creator_id: uuid.UUID):
    return db.scalars(select(SocialAccount).where(SocialAccount.creator_id == creator_id)).all()


def add_social(db: Session, creator_id: uuid.UUID, data: dict) -> SocialAccount:
    platform = data["platform"]
    if platform not in _PLATFORMS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid platform")
    handle = (data.get("handle") or "").lstrip("@").strip()
    if not handle:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Handle is required")
    if data.get("follower_count", 0) < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "follower_count cannot be negative")
    # If they pasted a URL, reject it when it isn't this platform (anti-phishing).
    # Either way we STORE the canonical URL derived from the handle, so the stored
    # link can never disagree with the handle.
    submitted = (data.get("profile_url") or "").strip()
    if submitted and not urls.url_is_platform(platform, submitted):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"That URL isn't a {platform} profile link")
    profile_url = urls.social_profile_url(platform, handle)
    exists = db.scalar(select(SocialAccount).where(
        SocialAccount.creator_id == creator_id,
        SocialAccount.platform == platform,
        SocialAccount.handle == handle,
    ))
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "This handle is already added")
    social = SocialAccount(
        creator_id=creator_id, platform=platform, handle=handle,
        profile_url=profile_url, follower_count=data.get("follower_count", 0),
    )
    db.add(social)
    db.commit()
    db.refresh(social)
    recompute_completion(db, creator_id)
    return social


def delete_social(db: Session, creator_id: uuid.UUID, social_id: uuid.UUID) -> None:
    social = db.get(SocialAccount, social_id)
    if social is None or social.creator_id != creator_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Social account not found")
    db.delete(social)
    db.commit()
    recompute_completion(db, creator_id)


# ---- portfolio ----
def list_portfolio(db: Session, creator_id: uuid.UUID):
    return db.scalars(select(PortfolioItem).where(PortfolioItem.creator_id == creator_id)).all()


def add_portfolio(db: Session, creator_id: uuid.UUID, data: dict) -> PortfolioItem:
    if data.get("platform") is not None and data["platform"] not in _PLATFORMS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid platform")

    # Primary path: an uploaded video FILE (stored on R2), distinct from a
    # submission. The playable URL is resolved from the storage object at read
    # time so proxy/presigned URLs stay fresh.
    if data.get("storage_object_id"):
        obj = _require_owned_object(db, creator_id, data["storage_object_id"], "portfolio_video")
        item = PortfolioItem(
            creator_id=creator_id, storage_object_id=obj.id,
            brand_name=data.get("brand_name"), caption=data.get("caption"),
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        recompute_completion(db, creator_id)
        return item

    # Legacy path: an external video LINK (kept so older clients still work).
    video_url = (data.get("video_url") or "").strip()
    if not video_url:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload a video or provide a video link")
    if not urls.is_video_url(video_url):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Link must be a TikTok, Instagram, YouTube, X, or Facebook video/post URL",
        )
    canonical = urls.canonicalize_url(video_url)
    platform = data.get("platform") or urls.detect_platform(video_url)
    # Real video thumbnail so the card shows the actual frame, not a "Watch on
    # <platform>" placeholder. Uses the FAST resolver (no Apify actor) so the
    # add returns immediately — the actor path could take ~75s and time the
    # request out ("Failed to fetch"). None → clean fallback card, never a
    # broken image.
    from app.integrations import apify
    from app.services import thumbnails
    try:
        # Prefer a client-supplied thumbnail, else resolve one from the ORIGINAL
        # url (canonicalize_url strips query params like YouTube's ?v=ID and can
        # break oEmbed lookups). EITHER WAY re-host it: platform CDN images are
        # signed, short-lived and hotlink-blocked, so a stored CDN link renders
        # for nobody. rehost() returns a self-hosted URL unchanged and None on
        # failure → clean fallback card, never a broken image.
        raw_thumb = data.get("thumbnail_url") or apify.fast_thumbnail(platform, video_url)
        thumb = thumbnails.rehost(raw_thumb, "portfolio_thumb", creator_id)
    except Exception:  # noqa: BLE001
        thumb = None
    item = PortfolioItem(
        creator_id=creator_id, video_url=canonical,
        thumbnail_url=thumb, brand_name=data.get("brand_name"),
        caption=data.get("caption"), platform=platform,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    recompute_completion(db, creator_id)
    return item


def delete_portfolio(db: Session, creator_id: uuid.UUID, item_id: uuid.UUID) -> None:
    item = db.get(PortfolioItem, item_id)
    if item is None or item.creator_id != creator_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portfolio item not found")
    db.delete(item)
    db.commit()
    recompute_completion(db, creator_id)


# ---- top videos (Portfolio "Top Content") ----
# Link-based, up to 3, NO ownership verification (Bill: pasting the link is
# enough). Only TikTok and Instagram, per the two platform toggles.
TOP_VIDEO_PLATFORMS = {"tiktok", "instagram"}
MAX_TOP_VIDEOS = 3


def list_top_videos(db: Session, creator_id: uuid.UUID):
    return db.scalars(
        select(PortfolioItem)
        .where(PortfolioItem.creator_id == creator_id, PortfolioItem.is_top_content.is_(True))
        .order_by(PortfolioItem.created_at.asc())
    ).all()


def add_top_video(db: Session, creator_id: uuid.UUID, platform: str, video_url: str) -> PortfolioItem:
    platform = (platform or "").strip().lower()
    if platform not in TOP_VIDEO_PLATFORMS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Pick TikTok or Instagram")

    raw = (video_url or "").strip()
    if not raw or not urls.is_video_url(raw):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Paste a valid TikTok or Instagram video link")
    detected = urls.detect_platform(raw)
    if detected and detected != platform:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"That looks like a {detected} link, not {platform}")

    existing = list_top_videos(db, creator_id)
    if len(existing) >= MAX_TOP_VIDEOS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"You can add up to {MAX_TOP_VIDEOS} top videos")

    canonical = urls.canonicalize_url(raw)
    if any(p.video_url == canonical for p in existing):
        raise HTTPException(status.HTTP_409_CONFLICT, "That video is already in your top content")

    # Insert INSTANTLY — no thumbnail/stat fetch on this path. Fetching the
    # thumbnail synchronously (oEmbed + re-host) could take long enough that the
    # browser's request timed out ("Failed to fetch") even though the row was
    # saved. The thumbnail + view/like counts fill in via the async refresh the
    # client fires right after (refresh_top_video_stats), which also falls back
    # to a fast thumbnail. So the add is snappy and never appears to fail.
    item = PortfolioItem(
        creator_id=creator_id, video_url=canonical, thumbnail_url=None,
        platform=platform, is_top_content=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def refresh_top_video_stats(db: Session, creator_id: uuid.UUID, item_id: uuid.UUID) -> PortfolioItem:
    """Best-effort scrape of view/like counts. Raise-only: a failed/empty scrape
    never lowers a previously-seen count. Kept off the add path because the actor
    run can take up to ~90s."""
    from app.integrations import apify
    from app.services import thumbnails

    item = db.get(PortfolioItem, item_id)
    if item is None or item.creator_id != creator_id or not item.is_top_content:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Top video not found")

    stats = apify.post_stats(item.platform, item.video_url)
    if stats is not None:
        item.views = max(item.views, stats.views)
        item.likes = max(item.likes, stats.likes)
        if stats.thumbnail_url:
            hosted = thumbnails.rehost(stats.thumbnail_url, "portfolio_thumb", creator_id)
            if hosted:
                item.thumbnail_url = hosted
        db.commit()
        db.refresh(item)
    # A thumbnail is what the creator actually sees appear — if the (slow, and
    # sometimes empty) stats scrape didn't set one, fall back to the fast
    # oEmbed/og:image thumbnail so the card fills in reliably.
    if not item.thumbnail_url:
        hosted = thumbnails.rehost(apify.fast_thumbnail(item.platform, item.video_url), "portfolio_thumb", creator_id)
        if hosted:
            item.thumbnail_url = hosted
            db.commit()
            db.refresh(item)
    return item


# ---- experiences ----
# Auto-verified on add (Bill: no manual review). `kind` drives what the entry
# means; `title` carries the job title for a professional role and the type's
# own label otherwise, so the admin card can render every row uniformly.
EXPERIENCE_KINDS = {
    "organic_ugc": "Organic UGC",
    "ugc_paid_ad": "UGC paid ad",
    "professional_role": "Professional role",
}

ROLE_TITLES = [
    "Content creator",
    "Content strategist",
    "Social media manager",
    "Social media intern",
    "Campaign manager",
    "Community manager",
    "Influencer marketing manager",
    "Brand ambassador",
    "Other",
]

# Suggested option lists for the richer Add Experience form. The service stays
# lenient (free text is accepted) so the UI can evolve without a backend change;
# these just power the dropdowns/chips.
EXPERIENCE_PLATFORMS = ["tiktok", "instagram", "youtube", "twitter", "facebook", "linkedin", "other"]
DELIVERABLES = [
    "Short-form video",
    "Long-form video",
    "Photo / image",
    "Story",
    "Livestream",
    "Blog / article",
    "Product review",
    "Other",
]


def list_experiences(db: Session, creator_id: uuid.UUID):
    return db.scalars(
        select(CreatorExperience)
        .where(CreatorExperience.creator_id == creator_id)
        .order_by(CreatorExperience.created_at.desc())
    ).all()


def add_experience(db: Session, creator_id: uuid.UUID, data: dict) -> CreatorExperience:
    kind = (data.get("kind") or "").strip()
    if kind not in EXPERIENCE_KINDS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid experience type")

    if kind == "professional_role":
        title = (data.get("role_title") or "").strip()
        if not title:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Pick a job title")
        if title not in ROLE_TITLES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid job title")
    else:
        title = EXPERIENCE_KINDS[kind]

    # Brand/client name is now the primary required field (Bill: a creator
    # expects to say WHO the work was for). The website is optional; if the name
    # is blank we still fall back to the site's bare host so the card isn't empty.
    raw_url = (data.get("company_url") or "").strip()
    url = urls.canonicalize_url(raw_url) if raw_url else None
    org = (data.get("company_name") or "").strip() or (urls.bare_host(url) if url else "")
    if not org:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Add the brand or client name")

    def _clean(key: str):
        v = (data.get(key) or "").strip()
        return v or None

    platforms = [p for p in (data.get("platforms") or []) if isinstance(p, str) and p.strip()]

    item = CreatorExperience(
        creator_id=creator_id, kind=kind, title=title, org=org, url=url, verified=True,
        description=_clean("description"), platforms=platforms,
        deliverable=_clean("deliverable"), niche=_clean("niche"),
        work_url=(urls.canonicalize_url(data["work_url"].strip())
                  if (data.get("work_url") or "").strip() else None),
        results=_clean("results"), period=_clean("period"),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def delete_experience(db: Session, creator_id: uuid.UUID, item_id: uuid.UUID) -> None:
    item = db.get(CreatorExperience, item_id)
    if item is None or item.creator_id != creator_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Experience not found")
    db.delete(item)
    db.commit()


# ---- completion (server-owned) ----
# Not a gate — nothing here blocks joining a campaign or reaching the
# dashboard. `missing` is reported purely so the frontend can render
# encouragement cards ("add a social to get matched to more campaigns").
def recompute_completion(db: Session, creator_id: uuid.UUID) -> tuple[bool, list[str]]:
    prof = get_or_create_profile(db, creator_id)
    missing: list[str] = [f for f in _REQUIRED_FIELDS if getattr(prof, f) in (None, "")]
    n_social = db.scalar(select(func.count()).select_from(SocialAccount).where(
        SocialAccount.creator_id == creator_id))
    n_portfolio = db.scalar(select(func.count()).select_from(PortfolioItem).where(
        PortfolioItem.creator_id == creator_id))
    if not n_social:
        missing.append("social_account")
    if not n_portfolio:
        missing.append("portfolio_item")
    complete = not missing
    prof.completed_at = _now() if complete else None
    db.commit()
    return complete, missing


# ---- apply-readiness (this IS a gate — join_campaign requires it) ----
# Mandatory before a creator can apply to a campaign, and mirrored by the
# onboarding wizard's step-gating: About (creator type), Socials (at least one
# connected account), Videos (>=1). Order matters — the "complete your profile"
# popup routes the creator to `next_section`. Details (birthday/location) and
# Payment are NOT required — creators can fill those in later.
#
# NOTE: joining requires only that a creator has CONNECTED a social account, not
# that they've bio-verified it — verification is a real bio-code scrape and is
# far too much friction to gate the whole funnel on (and it required BOTH
# Instagram AND TikTok, which blocked everyone). Verification remains an
# optional trust badge; this also keeps this gate consistent with the lenient
# `recompute_completion` that feeds GET /profile's `completed` flag.
SECTION_ORDER = ["about", "socials", "videos"]


def _verified(db: Session, creator_id: uuid.UUID, platform: str) -> bool:
    return db.scalar(select(SocialAccount.id).where(
        SocialAccount.creator_id == creator_id, SocialAccount.platform == platform,
        SocialAccount.is_verified.is_(True))) is not None


def _has_any_social(db: Session, creator_id: uuid.UUID) -> bool:
    return db.scalar(select(SocialAccount.id).where(
        SocialAccount.creator_id == creator_id)) is not None


def profile_completeness(db: Session, creator_id: uuid.UUID) -> dict:
    prof = get_or_create_profile(db, creator_id)
    n_portfolio = db.scalar(select(func.count()).select_from(PortfolioItem).where(
        PortfolioItem.creator_id == creator_id))
    sections = {
        "about": bool((prof.creator_type or "").strip()),
        "socials": _has_any_social(db, creator_id),
        "videos": bool(n_portfolio),
    }
    next_section = next((s for s in SECTION_ORDER if not sections[s]), None)
    return {"complete": next_section is None, "sections": sections, "next_section": next_section}
