"""Fetch a topic-relevant stock photo for a campaign that has no uploaded banner.

Uses the Pexels API (free, high-quality, 200 req/hr, no attribution required).
Everything here is best-effort: any failure returns None so the caller can fall
back to the client-side niche/gradient thumbnail — a missing banner must never
block campaign creation.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.core.config import get_settings

log = logging.getLogger("stock_images")

_PEXELS_SEARCH = "https://api.pexels.com/v1/search"
_OPENVERSE_SEARCH = "https://api.openverse.org/v1/images/"


def search_topic_image(query: str) -> Optional[str]:
    """Return the URL of the best landscape photo for `query`, or None.

    Pexels first (highest quality, needs a free key); if no key or no result,
    fall back to Openverse — a keyless, commercially-licensed image search — so
    the feature works out of the box. Both are best-effort.
    """
    query = (query or "").strip()
    if not query:
        return None
    return _pexels(query) or _openverse(query) or _loremflickr(query)


def _pexels(query: str) -> Optional[str]:
    key = get_settings().pexels_api_key
    if not key:
        return None
    try:
        resp = httpx.get(
            _PEXELS_SEARCH,
            params={"query": query, "per_page": 1, "orientation": "landscape"},
            headers={"Authorization": key},
            timeout=8,
        )
    except httpx.HTTPError as exc:
        log.warning("pexels request failed for %r: %s", query, exc)
        return None
    if resp.status_code != 200:
        log.warning("pexels %s for %r: %s", resp.status_code, query, resp.text[:200])
        return None
    photos = (resp.json() or {}).get("photos") or []
    if not photos:
        return None
    src = photos[0].get("src") or {}
    # landscape (banner-shaped) → large → original, whichever exists first.
    return src.get("landscape") or src.get("large") or src.get("original")


def _openverse(query: str) -> Optional[str]:
    """Keyless fallback. Commercial-use, non-mature results only."""
    try:
        resp = httpx.get(
            _OPENVERSE_SEARCH,
            params={
                "q": query,
                "page_size": 1,
                "license_type": "commercial",
                "mature": "false",
                "aspect_ratio": "wide",
            },
            headers={"User-Agent": "LuminaCreators/1.0 (campaign banners)"},
            timeout=8,
        )
    except httpx.HTTPError as exc:
        log.warning("openverse request failed for %r: %s", query, exc)
        return None
    if resp.status_code != 200:
        log.warning("openverse %s for %r", resp.status_code, query)
        return None
    results = (resp.json() or {}).get("results") or []
    if not results:
        return None
    return results[0].get("url") or results[0].get("thumbnail")


def _loremflickr(query: str) -> Optional[str]:
    """Always-hits keyless fallback. LoremFlickr returns a real, banner-shaped
    Flickr photo for the given tags (and a random one if the tag is empty), so a
    campaign is never left without art. `/g/` = safe-for-work only. The URL is
    hotlink-stable, so it works even if re-hosting can't run."""
    from urllib.parse import quote

    tag = quote(query.lower().replace(" ", ","))
    return f"https://loremflickr.com/1200/400/{tag}/all" if tag else "https://loremflickr.com/1200/400"
