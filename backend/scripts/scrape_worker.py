"""Apify stats worker — updates submission views/likes/comments on a 24h cycle.

Runs as a Render Background Worker (start: python scripts/scrape_worker.py).
Golden rule 7: durable work via the scrape_jobs table, never in-request.

Cycle: pick due scrape_jobs -> batch per platform -> run the platform's Apify
actor -> match results to submissions by canonical URL key -> update stats +
estimated_amount (views/1000 * cpm_rate_snapshot * eligible_pct) -> reschedule
next_run_at = now + 24h. Failures back off 1h, give up after max_attempts.

Actor inputs/extraction adapted from the battle-tested Lumina Clippers worker.
Test mode: python scripts/scrape_worker.py --once   (one pass, then exit)
"""
import json
import logging
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

import os  # noqa: E402

from sqlalchemy import or_, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.security import _now  # noqa: E402
from app.db.session import get_engine  # noqa: E402
from app.models import ScrapeJob, Submission  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [WORKER] %(levelname)s %(message)s",
                    datefmt="%Y-%m-%d %H:%M:%S", stream=sys.stdout)
log = logging.getLogger("worker")

APIFY_BASE = "https://api.apify.com/v2"
APIFY_TOKEN = os.environ.get("APIFY_TOKEN", "")
POLL_SEC = 60           # DB poll interval
RESCRAPE_HOURS = 24     # Bill: stats update on a 24h interval
RETRY_HOURS = 1         # failed-run backoff
BATCH = 25              # URLs per actor run
ACTOR_POLL_SEC = 5
ACTOR_TIMEOUT_POLLS = 120  # 10 min

PLATFORM_ACTORS = {
    "tiktok": "clockworks~tiktok-scraper",
    "instagram": "apify~instagram-reel-scraper",
    "youtube": "streamers~youtube-scraper",
    "twitter": "xquik~x-tweet-scraper",
    "facebook": "clappi~facebook-posts-reels-scraper",
}


# ── URL canonicalisation (match actor results back to submissions) ──────────
def _ig_reel(url: str) -> str:
    return re.sub(r"/(p|tv)/", "/reel/", url)


def _tweet_id(url: str):
    m = re.search(r"/status/(\d+)", url)
    return m.group(1) if m else None


def url_key(platform: str, url: str):
    """Stable identity for a post URL, resilient to www/x.com/param noise."""
    if not url:
        return None
    u = url.split("?")[0].rstrip("/")
    if platform == "tiktok":
        m = re.search(r"/(video|photo)/(\d+)", u)
        return f"tiktok:{m.group(2)}" if m else u.lower()
    if platform == "instagram":
        m = re.search(r"/(reel|p|tv)/([A-Za-z0-9_-]+)", u)
        return f"instagram:{m.group(2)}" if m else u.lower()
    if platform == "youtube":
        m = re.search(r"(?:v=|shorts/|youtu\.be/)([A-Za-z0-9_-]{6,})", url)
        return f"youtube:{m.group(1)}" if m else u.lower()
    if platform == "twitter":
        tid = _tweet_id(u)
        return f"twitter:{tid}" if tid else u.lower()
    return u.lower().replace("www.", "").replace("//m.", "//")


def item_key(platform: str, item: dict):
    """Canonical key for an actor result item (field names vary per actor)."""
    if platform == "twitter":
        tid = item.get("id") or item.get("id_str") or _tweet_id(item.get("url", "") or item.get("twitterUrl", ""))
        return f"twitter:{tid}" if tid else None
    if platform == "youtube":
        vid = item.get("id")
        if isinstance(vid, str) and len(vid) >= 6:
            return f"youtube:{vid}"
    for f in ("webVideoUrl", "postPage", "url", "inputUrl", "postUrl", "facebookUrl"):
        if item.get(f):
            return url_key(platform, item[f])
    return None


# ── actor I/O (inputs + extraction from the Clippers reference) ──────────────
def actor_input(platform: str, urls: list) -> dict:
    if platform == "tiktok":
        return {"postURLs": urls, "resultsPerPage": len(urls), "excludePinnedPosts": False,
                "proxyCountryCode": "None", "scrapeRelatedVideos": False,
                "shouldDownloadAvatars": False, "shouldDownloadCovers": False,
                "shouldDownloadMusicCovers": False, "shouldDownloadSlideshowImages": False,
                "shouldDownloadVideos": False}
    if platform == "instagram":
        # resultsLimit=1 forces 1:1 input->result; without it the actor can return
        # a whole profile's reels (a $7 mistake the Clippers team already made).
        return {"dataDetailLevel": "basicData", "resultsLimit": 1, "skipPinnedPosts": False,
                "username": [_ig_reel(u) for u in urls]}
    if platform == "youtube":
        return {"startUrls": [{"url": u} for u in urls], "maxResultStreams": 0,
                "maxResultsShorts": 0, "downloadSubtitles": False, "saveSubsToKVS": False,
                "hasCC": False, "hasLocation": False, "hasSubtitles": False, "is360": False,
                "is3D": False, "is4K": False, "isBought": False, "isHD": False, "isHDR": False,
                "isLive": False, "isVR180": False, "preferAutoGeneratedSubtitles": False,
                "subtitlesFormat": "plaintext", "subtitlesLanguage": "en"}
    if platform == "twitter":
        return {"tweetIds": [t for t in (_tweet_id(u) for u in urls) if t]}
    if platform == "facebook":
        return {"postUrls": urls}
    return {}


def _nn(v) -> int:
    try:
        return max(0, int(v or 0))
    except (TypeError, ValueError):
        return 0


def extract_stats(platform: str, item: dict) -> dict:
    if platform == "tiktok":
        thumb = (item.get("videoMeta") or {}).get("coverUrl", "") if isinstance(item.get("videoMeta"), dict) else ""
        return {"views": _nn(item.get("playCount")), "likes": _nn(item.get("diggCount")),
                "comments": _nn(item.get("commentCount")), "thumbnail": thumb}
    if platform == "instagram":
        return {"views": _nn(item.get("videoPlayCount")) or _nn(item.get("videoViewCount")),
                "likes": _nn(item.get("likesCount")), "comments": _nn(item.get("commentsCount")),
                "thumbnail": item.get("displayUrl", "") or ""}
    if platform == "youtube":
        thumbs = item.get("thumbnails") or []
        thumb = thumbs[-1].get("url", "") if isinstance(thumbs, list) and thumbs and isinstance(thumbs[-1], dict) else item.get("thumbnailUrl", "") or ""
        return {"views": _nn(item.get("viewCount")), "likes": _nn(item.get("likes")),
                "comments": _nn(item.get("commentsCount")), "thumbnail": thumb}
    if platform == "twitter":
        return {"views": _nn(item.get("viewCount")), "likes": _nn(item.get("likeCount")),
                "comments": _nn(item.get("replyCount")), "thumbnail": ""}
    if platform == "facebook":
        return {"views": _nn(item.get("views")), "likes": _nn(item.get("likes")),
                "comments": _nn(item.get("comments")), "thumbnail": item.get("thumbnail", "") or ""}
    return {"views": 0, "likes": 0, "comments": 0, "thumbnail": ""}


def _api(url: str, payload=None):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Content-Type": "application/json"}, method="POST" if payload is not None else "GET")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or "{}")


def run_actor(platform: str, urls: list) -> tuple:
    """Start actor -> poll to completion -> return (dataset items, run_id)."""
    actor = PLATFORM_ACTORS[platform]
    run = _api(f"{APIFY_BASE}/acts/{actor}/runs?token={APIFY_TOKEN}", actor_input(platform, urls))
    run_id = run["data"]["id"]
    for _ in range(ACTOR_TIMEOUT_POLLS):
        time.sleep(ACTOR_POLL_SEC)
        status = _api(f"{APIFY_BASE}/actor-runs/{run_id}?token={APIFY_TOKEN}")["data"]["status"]
        if status == "SUCCEEDED":
            items = _api(f"{APIFY_BASE}/actor-runs/{run_id}/dataset/items?token={APIFY_TOKEN}&clean=true")
            return (items if isinstance(items, list) else []), run_id
        if status in ("FAILED", "ABORTED", "TIMED-OUT"):
            raise RuntimeError(f"Apify run {run_id} {status}")
    raise RuntimeError(f"Apify run {run_id} timed out")


# ── the pass ──────────────────────────────────────────────────────────────────
def process_due_jobs(db: Session) -> int:
    now = _now()
    jobs = db.scalars(
        select(ScrapeJob)
        .where(ScrapeJob.next_run_at <= now,
               ScrapeJob.status.in_(("queued", "success", "failed")),
               ScrapeJob.attempts < ScrapeJob.max_attempts)
        .order_by(ScrapeJob.next_run_at)
        .limit(200)
    ).all()
    if not jobs:
        return 0

    subs = {s.id: s for s in db.scalars(
        select(Submission).where(Submission.id.in_([j.submission_id for j in jobs]))).all()}

    # group per platform
    by_platform: dict = {}
    for j in jobs:
        sub = subs.get(j.submission_id)
        if sub is None:
            j.status = "failed"; j.attempts = j.max_attempts
            continue
        by_platform.setdefault(sub.platform, []).append((j, sub))

    updated = 0
    for platform, pairs in by_platform.items():
        for i in range(0, len(pairs), BATCH):
            chunk = pairs[i:i + BATCH]
            for j, _s in chunk:
                j.status = "running"
            db.commit()
            urls = [s.post_url for _j, s in chunk]
            try:
                items, run_id = run_actor(platform, urls)
            except Exception as e:  # noqa: BLE001 — a bad batch must not kill the loop
                log.error("%s batch failed: %s", platform, str(e)[:200])
                for j, _s in chunk:
                    j.attempts += 1
                    j.last_error = str(e)[:500]
                    j.status = "failed" if j.attempts >= j.max_attempts else "queued"
                    j.next_run_at = _now() + timedelta(hours=RETRY_HOURS)
                    j.last_run_at = _now()
                db.commit()
                continue

            results = {}
            for item in items:
                k = item_key(platform, item)
                if k:
                    results[k] = item

            for j, sub in chunk:
                item = results.get(url_key(platform, sub.post_url) or "")
                if item:
                    stats = extract_stats(platform, item)
                    sub.views = stats["views"]
                    sub.likes = stats["likes"]
                    sub.comments = stats["comments"]
                    if stats["thumbnail"]:
                        sub.thumbnail_url = stats["thumbnail"]
                    pct = Decimal(sub.eligible_view_pct_snapshot or 100) / Decimal(100)
                    sub.estimated_amount = (Decimal(stats["views"]) / Decimal(1000)
                                            * Decimal(sub.cpm_rate_snapshot) * pct
                                            ).quantize(Decimal("0.0001"))
                    sub.scrape_status = "success"
                    sub.post_unavailable = False
                    sub.last_scraped_at = _now()
                    j.status = "success"
                    j.attempts = 0
                    j.last_apify_run_id = run_id
                    j.last_error = None
                    updated += 1
                else:
                    # actor ran but this post wasn't in the results — likely deleted/private
                    sub.scrape_status = "failed"
                    sub.post_unavailable = True
                    j.attempts += 1
                    j.last_apify_run_id = run_id
                    j.last_error = "post not found in actor results"
                    j.status = "failed" if j.attempts >= j.max_attempts else "queued"
                j.next_run_at = _now() + timedelta(hours=RESCRAPE_HOURS if j.status == "success" else RETRY_HOURS)
                j.last_run_at = _now()
            db.commit()
            log.info("%s: %d/%d submissions updated (run %s)", platform, len([1 for _j, s in chunk if s.scrape_status == 'success']), len(chunk), run_id)
    return updated


def main() -> None:
    once = "--once" in sys.argv
    if not APIFY_TOKEN:
        raise SystemExit("APIFY_TOKEN is not set")
    engine = get_engine()
    log.info("Apify stats worker started (rescrape every %dh)%s", RESCRAPE_HOURS, " [ONCE]" if once else "")
    while True:
        db = Session(engine)
        try:
            n = process_due_jobs(db)
            if n:
                log.info("pass complete — %d submission(s) updated", n)
        except Exception as e:  # noqa: BLE001
            log.error("pass error: %s", str(e)[:300])
            try:
                db.rollback()
            except Exception:  # noqa: BLE001
                pass
        finally:
            db.close()
        if once:
            break
        time.sleep(POLL_SEC)


if __name__ == "__main__":
    main()
