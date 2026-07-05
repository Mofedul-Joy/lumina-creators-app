"""Apify actor client: run a batch scrape and normalize the dataset into
per-post view/like/comment counts, matched back to submissions by a stable key.

Standard off-the-shelf actors only. Instagram's age-restriction wall (which
needs a warmed burner account + matched residential proxy + a custom actor to
get past) is a deliberately deferred follow-up — not needed for typical brand
UGC content, and a lot of infrastructure to take on speculatively.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Optional

import httpx

from app.core.config import get_settings
from app.services import urls

APIFY_BASE = "https://api.apify.com/v2"

# One actor per platform. Swappable without code changes if a better/cheaper
# actor shows up later.
PLATFORM_ACTORS = {
    "tiktok": "clockworks~tiktok-scraper",
    "instagram": "apify~instagram-reel-scraper",
    "youtube": "streamers~youtube-scraper",
    "twitter": "xquik~x-tweet-scraper",
    "facebook": "clappi~facebook-posts-reels-scraper",
}

# Actor runs are batched to keep each run's dataset a manageable size and to
# bound how much a single misconfigured run can cost.
BATCH_SIZE = 50


@dataclass
class ScrapedStats:
    views: int
    likes: int
    comments: int
    thumbnail_url: Optional[str] = None


class ApifyNotConfigured(RuntimeError):
    pass


def _token() -> str:
    token = get_settings().apify_api_token
    if not token:
        raise ApifyNotConfigured("APIFY_API_TOKEN is not configured")
    return token


def _run_input(platform: str, post_urls: list[str]) -> dict:
    if platform == "instagram":
        # resultsLimit MUST be 1 per profile URL — omitting it fetches every
        # reel on the profile instead of just the one requested (a lumina-
        # clippers incident once returned 3,041 reels for ~150 requested URLs).
        return {"directUrls": post_urls, "resultsLimit": 1}
    if platform == "tiktok":
        # Covers are needed for submission thumbnails — this was previously off,
        # which is the whole reason TikTok thumbnails never showed up anywhere.
        return {"postURLs": post_urls, "shouldDownloadVideos": False, "shouldDownloadCovers": True}
    if platform == "youtube":
        return {"startUrls": [{"url": u} for u in post_urls], "maxResults": 1}
    if platform == "twitter":
        return {"startUrls": post_urls}
    if platform == "facebook":
        return {"startUrls": post_urls}
    raise ValueError(f"No Apify actor configured for platform {platform!r}")


def start_run(platform: str, post_urls: list[str]) -> str:
    actor = PLATFORM_ACTORS[platform]
    resp = httpx.post(
        f"{APIFY_BASE}/acts/{actor}/runs",
        params={"token": _token()},
        json=_run_input(platform, post_urls),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["data"]["id"]


def poll_run(run_id: str, *, timeout_sec: Optional[int] = None, interval_sec: Optional[int] = None) -> dict:
    settings = get_settings()
    timeout_sec = timeout_sec or settings.apify_run_timeout_sec
    interval_sec = interval_sec or settings.apify_poll_interval_sec
    deadline = time.monotonic() + timeout_sec
    while True:
        resp = httpx.get(f"{APIFY_BASE}/actor-runs/{run_id}", params={"token": _token()}, timeout=30)
        resp.raise_for_status()
        run = resp.json()["data"]
        if run["status"] in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
            return run
        if time.monotonic() > deadline:
            return run  # caller treats a non-SUCCEEDED status as failed
        time.sleep(interval_sec)


def fetch_dataset(dataset_id: str) -> list[dict]:
    resp = httpx.get(f"{APIFY_BASE}/datasets/{dataset_id}/items", params={"token": _token()}, timeout=60)
    resp.raise_for_status()
    return resp.json()


def run_usage_usd(run_id: str) -> float:
    try:
        resp = httpx.get(f"{APIFY_BASE}/actor-runs/{run_id}", params={"token": _token()}, timeout=30)
        resp.raise_for_status()
        return float(resp.json()["data"].get("usage", {}).get("totalUsageUsd") or 0)
    except Exception:
        return 0.0


def _nn(value) -> int:
    """Non-negative int. Apify returns -1 for platforms that hide a count
    (e.g. hidden like counts) — clamp instead of persisting a negative number."""
    try:
        n = int(value)
    except (TypeError, ValueError):
        return 0
    return n if n > 0 else 0


def _item_url(platform: str, item: dict) -> Optional[str]:
    if platform == "tiktok":
        return item.get("webVideoUrl") or item.get("input")
    if platform == "instagram":
        return item.get("url") or item.get("inputUrl")
    if platform == "youtube":
        return item.get("url") or item.get("videoUrl") or item.get("input")
    if platform == "twitter":
        return item.get("url") or item.get("twitterUrl")
    if platform == "facebook":
        return item.get("url") or item.get("postUrl")
    return item.get("url")


def _item_stats(platform: str, item: dict) -> ScrapedStats:
    if platform == "tiktok":
        return ScrapedStats(_nn(item.get("playCount")), _nn(item.get("diggCount")), _nn(item.get("commentCount")))
    if platform == "instagram":
        return ScrapedStats(_nn(item.get("videoPlayCount") or item.get("videoViewCount")),
                             _nn(item.get("likesCount")), _nn(item.get("commentsCount")))
    if platform == "youtube":
        return ScrapedStats(_nn(item.get("viewCount")), _nn(item.get("likes")), _nn(item.get("commentsCount")))
    if platform == "twitter":
        return ScrapedStats(_nn(item.get("viewCount")), _nn(item.get("likeCount")), _nn(item.get("replyCount")))
    if platform == "facebook":
        return ScrapedStats(_nn(item.get("videoViewCount") or item.get("viewsCount")),
                             _nn(item.get("likesCount") or item.get("reactionsCount")), _nn(item.get("commentsCount")))
    return ScrapedStats(0, 0, 0)


# Best-effort cover/thumbnail field names for platforms without a confirmed
# actor schema (unlike TikTok's clockworks/tiktok-scraper, whose `covers`/
# `videoMeta` shape is documented and stable). First match wins; verify
# against a live dataset sample if a real scrape still comes back without one.
_THUMBNAIL_KEYS: dict[str, tuple[str, ...]] = {
    "instagram": ("displayUrl", "thumbnailUrl", "imageUrl"),
    "twitter": ("thumbnailUrl", "media_url_https", "mediaUrl"),
    "facebook": ("thumbnailUrl", "previewImage", "picture", "imageUrl"),
}


def _item_thumbnail(platform: str, item: dict, url: str) -> Optional[str]:
    if platform == "youtube":
        # No reliable cover field in this actor's dataset — the public
        # img.youtube.com endpoint is a stable, no-auth thumbnail source keyed
        # off the video ID alone, independent of anything Apify returns.
        video_id = urls.youtube_video_id(url)
        return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg" if video_id else None
    if platform == "tiktok":
        covers = item.get("covers") or {}
        video_meta = item.get("videoMeta") or {}
        return covers.get("default") or covers.get("origin") or video_meta.get("coverUrl")
    for key in _THUMBNAIL_KEYS.get(platform, ()):
        value = item.get(key)
        if value:
            return value
    return None


def match_dataset(platform: str, dataset: list[dict]) -> dict[str, ScrapedStats]:
    """Map stable match-key -> scraped stats, for every item Apify returned."""
    out: dict[str, ScrapedStats] = {}
    for item in dataset:
        url = _item_url(platform, item)
        if not url:
            continue
        stats = _item_stats(platform, item)
        stats.thumbnail_url = _item_thumbnail(platform, item, url)
        out[urls.match_key(platform, url)] = stats
    return out


def scrape_batch(platform: str, post_urls: list[str]) -> tuple[dict[str, ScrapedStats], float]:
    """Run one actor over up to BATCH_SIZE URLs; returns (matched stats by key, cost_usd)."""
    run_id = start_run(platform, post_urls)
    run = poll_run(run_id)
    cost = run_usage_usd(run_id)
    if run["status"] != "SUCCEEDED":
        return {}, cost
    dataset_id = run["defaultDatasetId"]
    dataset = fetch_dataset(dataset_id)
    return match_dataset(platform, dataset), cost
