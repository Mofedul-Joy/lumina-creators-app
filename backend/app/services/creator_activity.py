"""Charts + headline numbers for the admin creator profile.

Weekly Post Overview — posts per weekday, this week vs last week. Derived from
submissions.created_at, so it is real from day one.

Views Growth — daily view totals over a window. Derived from
submission_view_snapshots (0023), which the scrape worker started writing on
every successful scrape. History only exists from the first scrape after that
shipped; before then the series is legitimately empty and the chart says so
rather than inventing a line.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import Numeric, cast, func, select
from sqlalchemy.orm import Session

from app.core.security import _now
from app.models import PayoutItem, Submission, SubmissionViewSnapshot

DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
VIEWS_WINDOW_DAYS = 7


def _week_start(d: date) -> date:
    """Monday of the week `d` falls in."""
    return d - timedelta(days=d.weekday())


def weekly_posts(db: Session, creator_id: uuid.UUID) -> list[dict]:
    """7 entries, Mon..Sun: this week's post count vs last week's, per weekday."""
    today = _now().date()
    this_start = _week_start(today)
    last_start = this_start - timedelta(days=7)

    rows = db.execute(
        select(
            func.date(Submission.created_at).label("day"),
            func.count(Submission.id).label("posts"),
        )
        .where(
            Submission.creator_id == creator_id,
            func.date(Submission.created_at) >= last_start,
        )
        .group_by("day")
    ).all()
    by_day: dict[date, int] = {r.day: int(r.posts) for r in rows}

    out = []
    for i, label in enumerate(DAY_LABELS):
        this_day = this_start + timedelta(days=i)
        last_day = last_start + timedelta(days=i)
        out.append({
            "day": label,
            "date": this_day.isoformat(),
            "this_week": by_day.get(this_day, 0),
            "last_week": by_day.get(last_day, 0),
        })
    return out


def views_growth(db: Session, creator_id: uuid.UUID, days: int = VIEWS_WINDOW_DAYS) -> list[dict]:
    """Total views per day across the creator's posts.

    A submission can be scraped many times a day, so take the LAST snapshot per
    submission per day (its running total), then sum across submissions — summing
    every snapshot would multiply-count the same views.
    """
    since = _now().date() - timedelta(days=days - 1)

    day = func.date(SubmissionViewSnapshot.captured_at).label("day")
    # Latest snapshot per (submission, day) — the day's ending view count.
    per_sub = (
        select(
            day,
            SubmissionViewSnapshot.submission_id.label("sid"),
            func.max(SubmissionViewSnapshot.views).label("views"),
        )
        .where(
            SubmissionViewSnapshot.creator_id == creator_id,
            func.date(SubmissionViewSnapshot.captured_at) >= since,
        )
        .group_by(day, SubmissionViewSnapshot.submission_id)
        .subquery()
    )
    rows = db.execute(
        select(per_sub.c.day, func.sum(per_sub.c.views).label("views"))
        .group_by(per_sub.c.day)
        .order_by(per_sub.c.day)
    ).all()
    by_day = {r.day: int(r.views or 0) for r in rows}

    # Dense series (a gap must render as a point on the line, not a hole), and a
    # day with no scrape carries the previous day's total forward.
    out: list[dict] = []
    running = 0
    for i in range(days):
        d = since + timedelta(days=i)
        if d in by_day:
            running = by_day[d]
        out.append({"date": d.isoformat(), "views": running})
    return out


def headline(db: Session, creator_id: uuid.UUID) -> dict:
    """Total posts / views / owed / avg CPM — the stat tiles above the Posts tab."""
    agg = db.execute(
        select(
            func.count(Submission.id).label("posts"),
            func.coalesce(func.sum(Submission.views), 0).label("views"),
            func.coalesce(func.sum(Submission.estimated_amount), 0).label("earned"),
            func.coalesce(
                func.avg(cast(Submission.cpm_rate_snapshot, Numeric(12, 4))), 0
            ).label("avg_cpm"),
        ).where(Submission.creator_id == creator_id)
    ).one()

    paid = db.scalar(
        select(func.coalesce(func.sum(PayoutItem.amount), 0))
        .join(Submission, Submission.id == PayoutItem.submission_id)
        .where(Submission.creator_id == creator_id)
    ) or Decimal(0)

    earned = Decimal(agg.earned)
    return {
        "total_posts": int(agg.posts),
        "total_views": int(agg.views),
        "total_earned": earned,
        "total_paid": Decimal(paid),
        # What they've earned but not yet been paid — never negative.
        "total_owed": max(earned - Decimal(paid), Decimal(0)),
        "avg_cpm": Decimal(agg.avg_cpm),
    }


def activity(db: Session, creator_id: uuid.UUID) -> dict:
    return {
        "weekly_posts": weekly_posts(db, creator_id),
        "views_growth": views_growth(db, creator_id),
        **headline(db, creator_id),
    }
