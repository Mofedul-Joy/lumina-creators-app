"""Probe whether a submitted post is still embeddable, using each platform's
public oEmbed endpoint. Used as a fallback when Apify returns zero items for a
URL (post may be gone, geo-restricted, or just a flaky scrape) — Apify itself
stays the source of truth for view counts and self-heals these flags whenever
it does return fresh data.

Instagram is the only platform with a real "post is alive but not embeddable
here" (geo-restricted) state; the others' embeds work everywhere a post is
live, so they only have a healthy/unavailable split.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

import httpx

Verdict = Literal["healthy", "geo_restricted", "unavailable"]

_OEMBED = {
    "tiktok": "https://www.tiktok.com/oembed",
    "twitter": "https://publish.twitter.com/oembed",
    "youtube": "https://www.youtube.com/oembed",
    "instagram": "https://www.instagram.com/api/v1/oembed/",
}


@dataclass
class EmbedFlags:
    embed_broken: bool
    post_unavailable: bool


def _flags(verdict: Optional[Verdict]) -> Optional[EmbedFlags]:
    if verdict is None:
        return None
    if verdict == "healthy":
        return EmbedFlags(embed_broken=False, post_unavailable=False)
    if verdict == "geo_restricted":
        return EmbedFlags(embed_broken=True, post_unavailable=False)
    return EmbedFlags(embed_broken=True, post_unavailable=True)  # unavailable


def _probe_instagram(url: str) -> Optional[Verdict]:
    try:
        resp = httpx.get(_OEMBED["instagram"], params={"url": url}, timeout=10)
    except httpx.HTTPError:
        return None
    if resp.status_code == 200:
        return "healthy"
    if resp.status_code == 400 and "geoblock" in resp.text.lower():
        return "geo_restricted"
    if resp.status_code == 404:
        return "unavailable"
    return None  # ambiguous (403/5xx/rate-limited) — don't guess


def _probe_2way(platform: str, url: str) -> Optional[Verdict]:
    try:
        resp = httpx.get(_OEMBED[platform], params={"url": url}, timeout=10)
    except httpx.HTTPError:
        return None
    if resp.status_code == 200:
        return "healthy"
    if resp.status_code == 404:
        return "unavailable"
    return None  # never flag on rate-limit/5xx — indeterminate, leave as-is


def probe(platform: str, url: str) -> Optional[EmbedFlags]:
    """Returns None when the probe is indeterminate — caller should leave
    existing flags untouched rather than guess."""
    if platform == "instagram":
        return _flags(_probe_instagram(url))
    if platform in _OEMBED:
        return _flags(_probe_2way(platform, url))
    return None  # facebook: no public oEmbed without a Meta App ID
