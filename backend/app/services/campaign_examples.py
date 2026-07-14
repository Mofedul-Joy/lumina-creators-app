"""Campaign example videos — admin-curated or auto-selected from top performers.

Each example carries its own re-hosted thumbnail (fetched once, stored on our
own R2 so it loads instantly and never hotlink-breaks). Auto examples only fill
in when an admin hasn't added any, and once created they persist so the admin
can delete individual ones.
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.integrations import apify
from app.models import CampaignExampleVideo, Submission
from app.services import thumbnails, urls

MAX_EXAMPLES = 5


def _resolve_thumbnail(platform: Optional[str], url: str, campaign_id: uuid.UUID) -> Optional[str]:
    """Fetch the social video's thumbnail and re-host it on our storage. Fast
    resolver (oEmbed/og:image) so it's safe inline; best-effort → None on fail."""
    try:
        raw = apify.fast_thumbnail(platform or "", url)
        return thumbnails.rehost(raw, "example_thumb", campaign_id)
    except Exception:  # noqa: BLE001 - a thumbnail is cosmetic, never block the add
        return None


def list_examples(db: Session, campaign_id: uuid.UUID) -> list[CampaignExampleVideo]:
    return db.scalars(
        select(CampaignExampleVideo)
        .where(CampaignExampleVideo.campaign_id == campaign_id)
        .order_by(CampaignExampleVideo.sort_order.asc(), CampaignExampleVideo.created_at.asc())
    ).all()


def add_example(db: Session, campaign_id: uuid.UUID, raw_url: str,
                source: str = "admin", thumbnail_url: Optional[str] = None) -> CampaignExampleVideo:
    """Add one example video (a social link, or an already-hosted URL). Detects
    the platform and caches the thumbnail. Ignores an exact duplicate URL."""
    # Keep the RAW url — canonicalize_url strips query params (e.g. YouTube's
    # ?v=<id>), which would both break the click-through link AND stop the
    # thumbnail resolver from finding the video id.
    url = (raw_url or "").strip()
    if not url:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Add a video link")
    platform = urls.detect_platform(url)
    existing = db.scalar(select(CampaignExampleVideo).where(
        CampaignExampleVideo.campaign_id == campaign_id, CampaignExampleVideo.url == url))
    if existing is not None:
        return existing
    thumb = thumbnail_url or _resolve_thumbnail(platform, url, campaign_id)
    n = db.scalar(select(func.count(CampaignExampleVideo.id)).where(
        CampaignExampleVideo.campaign_id == campaign_id)) or 0
    item = CampaignExampleVideo(
        campaign_id=campaign_id, url=url, platform=platform,
        thumbnail_url=thumb, source=source, sort_order=n,
    )
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return db.scalar(select(CampaignExampleVideo).where(
            CampaignExampleVideo.campaign_id == campaign_id, CampaignExampleVideo.url == url))
    db.refresh(item)
    return item


def delete_example(db: Session, campaign_id: uuid.UUID, example_id: uuid.UUID) -> None:
    item = db.get(CampaignExampleVideo, example_id)
    if item is None or item.campaign_id != campaign_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Example video not found")
    db.delete(item)
    db.commit()


def ensure_auto_examples(db: Session, campaign_id: uuid.UUID) -> None:
    """When a campaign has NO admin-added examples and NO auto examples yet,
    seed up to MAX_EXAMPLES from its best verified submissions (most views).
    Idempotent: skips once any example exists, so admin deletions stick and we
    don't re-add what was removed. Reuses each submission's already-cached
    thumbnail. No admin approval needed."""
    existing = db.scalar(select(func.count(CampaignExampleVideo.id)).where(
        CampaignExampleVideo.campaign_id == campaign_id)) or 0
    if existing:
        return
    top = db.execute(
        select(Submission.post_url, Submission.platform, Submission.thumbnail_url)
        .where(
            Submission.campaign_id == campaign_id,
            Submission.verification_status == "verified",
            Submission.is_suspicious.is_(False),
            Submission.post_unavailable.is_(False),
        )
        .order_by(Submission.views.desc())
        .limit(MAX_EXAMPLES)
    ).all()
    for i, (post_url, platform, thumb) in enumerate(top):
        if not post_url:
            continue
        db.add(CampaignExampleVideo(
            campaign_id=campaign_id, url=post_url, platform=platform,
            thumbnail_url=thumb, source="auto", sort_order=i,
        ))
    if top:
        try:
            db.commit()
        except IntegrityError:
            db.rollback()


def examples_public(db: Session, campaign_id: uuid.UUID) -> list[dict]:
    """What the creator overview shows: admin examples, or auto ones as fallback."""
    ensure_auto_examples(db, campaign_id)
    return [
        {"url": e.url, "platform": e.platform, "thumbnail_url": e.thumbnail_url}
        for e in list_examples(db, campaign_id)
    ]
