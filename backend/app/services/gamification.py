"""Shared gamification computation (Feature 7, BUILD_SPEC.md §3.9).

Centralizes the rank/xp/awards formulas that Feature 2's `admin_creators.py`
originally computed inline for the admin rich-detail card. This module is the
single source of truth for:
  - `compute_xp` / `compute_rank` / `compute_awards` — pure formulas.
  - `refresh_creator_gamification` / `refresh_all_gamification` — write-back
    helpers that persist the computed values onto `creator_profiles`, so the
    creator-facing endpoint (and admin refresh actions) can serve stored
    values instead of recomputing on every request.

`admin_creators.py` re-exports the pure functions (aliased to their original
private names) so its existing call sites keep working unchanged.
"""
from __future__ import annotations

import math
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Creator, CreatorProfile, Payout, Submission

# Gemstone rank thresholds (BUILD_SPEC.md §3.9) — ordered lowest to highest.
RANK_THRESHOLDS = (
    ("bronze", 0),
    ("sapphire", 100),
    ("gold", 500),
    ("emerald", 1500),
    ("amber", 4000),
    ("ruby", 8000),
)

RANK_LABELS = {
    "bronze": "Bronze",
    "sapphire": "Sapphire",
    "gold": "Gold",
    "emerald": "Emerald",
    "amber": "Amber",
    "ruby": "Ruby",
}

# Known awards, in a stable display order (used by the frontend award row too).
KNOWN_AWARDS = (
    "persistent_pro",
    "gig_completion_mastery",
    "earnings_mastery",
    "interview_mastery",
)


def compute_rank(xp: int) -> str:
    """Gemstone rank for a given XP total."""
    rank = RANK_THRESHOLDS[0][0]
    for name, floor in RANK_THRESHOLDS:
        if xp >= floor:
            rank = name
    return rank


def next_rank_info(xp: int) -> tuple[Optional[str], int]:
    """Returns (next_rank_or_None, xp_needed_to_reach_it). 0 needed + None next
    rank means the creator is already at the top (ruby)."""
    for name, floor in RANK_THRESHOLDS:
        if xp < floor:
            return name, floor - xp
    return None, 0


def compute_xp(total_views: int, total_posts: int, streak_days: int) -> int:
    """XP formula (BUILD_SPEC.md §3.9): views/100 (floored) + 5 per post + 1 per streak day."""
    return math.floor(total_views / 100) + total_posts * 5 + streak_days


def compute_awards(
    total_posts: int, total_earned: Decimal, streak_days: int, stored: Optional[List[str]] = None
) -> List[str]:
    """Awards earned so far. `interview_mastery` is a manual admin-set flag —
    no automatic computation — so it's only included if already present in
    `stored` (the previously-persisted awards list)."""
    awards: List[str] = []
    if streak_days >= 7:
        awards.append("persistent_pro")
    if total_posts >= 10:
        awards.append("gig_completion_mastery")
    if total_earned >= 500:
        awards.append("earnings_mastery")
    if stored and "interview_mastery" in stored:
        awards.append("interview_mastery")
    return awards


def _aggregate_stats(db: Session, creator_id: uuid.UUID) -> tuple[int, Decimal, int]:
    row = db.execute(
        select(
            func.coalesce(func.sum(Submission.views), 0),
            func.coalesce(func.sum(Submission.estimated_amount), 0),
            func.count(Submission.id),
        ).where(Submission.creator_id == creator_id)
    ).first()
    total_views = int(row[0]) if row else 0
    cpm_earned = Decimal(row[1]) if row else Decimal("0")
    total_posts = int(row[2]) if row else 0
    # estimated_amount is CPM-only (0 for fixed/per-post/per-hour campaigns), so a
    # creator paid entirely through those would show $0 earned and never unlock
    # earnings_mastery. Fall back to actual money paid out (all payment types) so
    # both the displayed figure and the award reflect real earnings.
    total_paid = Decimal(db.scalar(
        select(func.coalesce(func.sum(Payout.amount), 0)).where(
            Payout.creator_id == creator_id, Payout.status == "paid"
        )
    ) or 0)
    total_earned = max(cpm_earned, total_paid)
    return total_views, total_earned, total_posts


def refresh_creator_gamification(db: Session, creator_id: uuid.UUID) -> Optional[CreatorProfile]:
    """Recompute rank/xp/awards from live submission aggregates and persist
    them onto `creator_profiles`. Does NOT touch `streak_days` — that's owned
    by `bump_streak_on_submission`, which fires on submission-create; this
    write-back reuses whatever streak is currently stored. Returns the
    updated profile, or None if the creator has no profile row yet.
    """
    prof = db.scalar(select(CreatorProfile).where(CreatorProfile.creator_id == creator_id))
    if prof is None:
        return None
    total_views, total_earned, total_posts = _aggregate_stats(db, creator_id)
    streak_days = prof.streak_days or 0
    xp = compute_xp(total_views, total_posts, streak_days)
    rank = compute_rank(xp)
    awards = compute_awards(total_posts, total_earned, streak_days, prof.awards)

    prof.xp = xp
    prof.rank = rank
    prof.awards = awards
    db.commit()
    db.refresh(prof)
    return prof


def refresh_all_gamification(db: Session) -> int:
    """Iterate every creator with a profile and refresh their gamification
    fields. Returns the number of profiles updated."""
    creator_ids = db.scalars(select(CreatorProfile.creator_id)).all()
    count = 0
    for cid in creator_ids:
        if refresh_creator_gamification(db, cid) is not None:
            count += 1
    return count


def bump_streak_on_submission(db: Session, creator_id: uuid.UUID) -> int:
    """Recompute the creator's daily-submission streak from `Submission.created_at`
    history and persist it. Called after a successful submission-create.

    Streak = number of consecutive UTC days, ending today, with at least one
    submission. A gap of more than 1 day (i.e. no submission yesterday when
    there's none today either) breaks the streak back to 1 (today only) or 0.
    Idempotent: multiple submissions on the same UTC day don't inflate the
    count, since we count *distinct days*, not submissions.
    """
    prof = db.scalar(select(CreatorProfile).where(CreatorProfile.creator_id == creator_id))
    if prof is None:
        return 0

    # Distinct UTC calendar days that have at least one submission, newest first.
    day_expr = func.date(Submission.created_at)
    days = db.scalars(
        select(day_expr)
        .where(Submission.creator_id == creator_id)
        .group_by(day_expr)
        .order_by(day_expr.desc())
    ).all()
    if not days:
        prof.streak_days = 0
        db.commit()
        return 0

    today = date.today()
    newest = days[0]
    # Normalize in case the driver returns datetime instead of date.
    newest = newest if isinstance(newest, date) else newest.date()
    if newest != today:
        # No submission today yet (shouldn't happen right after a create, but
        # guards against clock skew) — streak is 0 until today has one.
        prof.streak_days = 0
        db.commit()
        return 0

    streak = 1
    expected = today - timedelta(days=1)
    for raw in days[1:]:
        d = raw if isinstance(raw, date) else raw.date()
        if d == expected:
            streak += 1
            expected -= timedelta(days=1)
        elif d < expected:
            break  # gap > 1 day — streak stops here

    prof.streak_days = streak
    db.commit()
    db.refresh(prof)
    return streak


def get_creator_gamification(db: Session, creator_id: uuid.UUID) -> dict:
    """Creator-facing gamification snapshot (Feature 7). Prefers the stored
    (persisted) rank/xp/awards columns when set, falling back to a live
    computation — mirrors the admin rich-detail fallback pattern from
    Feature 2 so the endpoint works correctly even before a refresh has run.
    """
    prof = db.scalar(select(CreatorProfile).where(CreatorProfile.creator_id == creator_id))
    total_views, total_earned, total_posts = _aggregate_stats(db, creator_id)
    streak_days = prof.streak_days if prof else 0
    xp = (prof.xp if prof and prof.xp else 0) or compute_xp(total_views, total_posts, streak_days)
    rank = (prof.rank if prof else None) or compute_rank(xp)
    awards = compute_awards(total_posts, total_earned, streak_days, prof.awards if prof else None)
    next_rank, xp_to_next = next_rank_info(xp)

    return {
        "rank": rank,
        "rank_label": RANK_LABELS.get(rank, rank.capitalize()),
        "xp": xp,
        "xp_to_next": xp_to_next,
        "next_rank": next_rank,
        "streak_days": streak_days,
        "awards": awards,
        "total_views": total_views,
        "total_earned": total_earned,
        "total_posts": total_posts,
    }
