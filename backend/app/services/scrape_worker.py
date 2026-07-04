"""Consumes the `scrape_jobs` queue: batches due jobs per platform, calls Apify,
and writes view/like/comment counts back onto `submissions`.

Critical invariant — RAISE-ONLY views: a re-scrape must never lower a stored
view count. A scrape returning 0 flags the post unavailable but keeps the
last-known count (a real incident elsewhere once silently zeroed out
age-restricted Instagram reels on re-scrape); a lower-but-nonzero read is also
kept, on the assumption it's a stale/rounded read rather than the true count.

Each scrape_jobs row is reused as a recurring job: on success it's requeued
`scrape_refresh_interval_hours` out so view counts keep climbing after the
first scrape, until the submission is rejected/paid/confirmed gone.
"""
from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.integrations import apify
from app.models import PayoutItem, ScrapeJob, Submission
from app.services import embed_health, urls

log = logging.getLogger("scrape_worker")

RETRY_BACKOFF_MIN = [5, 15, 60, 240, 1440]  # minutes, indexed by attempts-so-far


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_paid(db: Session, submission_id: uuid.UUID) -> bool:
    return db.scalar(
        select(PayoutItem.id).where(PayoutItem.submission_id == submission_id, PayoutItem.voided_at.is_(None))
    ) is not None


def _due_jobs(db: Session, limit: int) -> list[tuple[ScrapeJob, Submission]]:
    rows = db.execute(
        select(ScrapeJob, Submission)
        .join(Submission, Submission.id == ScrapeJob.submission_id)
        .where(
            ScrapeJob.status.in_(("queued", "failed")),
            ScrapeJob.next_run_at <= _now(),
            ScrapeJob.attempts < ScrapeJob.max_attempts,
            Submission.verification_status != "rejected",
        )
        .order_by(ScrapeJob.next_run_at.asc())
        .limit(limit)
    ).all()
    return [(j, s) for j, s in rows if not _is_paid(db, s.id)]


def _backoff(attempts: int) -> datetime:
    minutes = RETRY_BACKOFF_MIN[min(attempts, len(RETRY_BACKOFF_MIN) - 1)]
    return _now() + timedelta(minutes=minutes)


def _mark_failed(db: Session, job: ScrapeJob, error: str) -> None:
    job.attempts += 1
    job.status = "failed"
    job.last_error = error[:2000]
    job.last_run_at = _now()
    job.next_run_at = _backoff(job.attempts)


def _apply_stats(sub: Submission, stats: apify.ScrapedStats) -> None:
    if stats.views == 0:
        # 0 views from a batch that DID return results for other URLs almost
        # always means this specific post is gone/age-gated — but the raise-
        # only rule means we never let that zero out a previously-seen count.
        sub.post_unavailable = True
        sub.embed_broken = True
        sub.scrape_status = "failed"
        return
    if stats.views < sub.views:
        # Lower-but-nonzero reads are treated as stale/rounded, not a real drop.
        sub.scrape_status = "success"
        sub.embed_broken = False
        sub.post_unavailable = False
        return
    sub.views = stats.views
    sub.likes = max(sub.likes, stats.likes)
    sub.comments = max(sub.comments, stats.comments)
    sub.scrape_status = "success"
    sub.embed_broken = False
    sub.post_unavailable = False


def _apply_zero_item_fallback(sub: Submission) -> None:
    """Apify returned nothing at all for this URL — fall back to a direct
    embed-health probe instead of assuming the post is gone."""
    flags = embed_health.probe(sub.platform, sub.post_url)
    if flags is None:
        return  # indeterminate — leave existing flags/scrape_status alone
    sub.embed_broken = flags.embed_broken
    sub.post_unavailable = flags.post_unavailable
    sub.scrape_status = "failed" if flags.post_unavailable else "success"


def _process_chunk(db: Session, platform: str, pairs: list[tuple[ScrapeJob, Submission]]) -> None:
    for job, _ in pairs:
        job.status = "running"
    db.commit()

    try:
        matched, cost = apify.scrape_batch(platform, [s.post_url for _, s in pairs])
    except Exception as exc:  # noqa: BLE001 - one bad batch shouldn't crash the worker
        log.warning("apify batch failed for %s: %s", platform, exc)
        for job, _ in pairs:
            _mark_failed(db, job, str(exc))
        db.commit()
        return

    settings = get_settings()
    for job, sub in pairs:
        key = urls.match_key(platform, sub.post_url)
        stats = matched.get(key)
        if stats is None:
            _apply_zero_item_fallback(sub)
        else:
            _apply_stats(sub, stats)
        sub.last_scraped_at = _now()

        job.attempts += 1
        job.last_run_at = _now()
        if sub.post_unavailable:
            # Confirmed gone — stop burning Apify credits re-checking it.
            job.status = "failed"
            job.last_error = "post_unavailable"
        else:
            job.status = "queued"
            job.next_run_at = _now() + timedelta(hours=settings.scrape_refresh_interval_hours)
            job.last_error = None
    db.commit()
    if cost:
        log.info("apify batch (%s, %d urls) cost $%.4f", platform, len(pairs), cost)


def process_due_jobs(db: Session, limit_per_tick: int = 200) -> int:
    """One worker tick: claim due jobs, batch by platform, write back. Returns
    the number of jobs processed."""
    due = _due_jobs(db, limit_per_tick)
    if not due:
        return 0

    by_platform: dict[str, list[tuple[ScrapeJob, Submission]]] = defaultdict(list)
    for job, sub in due:
        by_platform[sub.platform].append((job, sub))

    processed = 0
    for platform, pairs in by_platform.items():
        if platform not in apify.PLATFORM_ACTORS:
            for job, _ in pairs:
                _mark_failed(db, job, f"no actor configured for platform {platform!r}")
            db.commit()
            continue
        for i in range(0, len(pairs), apify.BATCH_SIZE):
            chunk = pairs[i : i + apify.BATCH_SIZE]
            _process_chunk(db, platform, chunk)
            processed += len(chunk)
    return processed
