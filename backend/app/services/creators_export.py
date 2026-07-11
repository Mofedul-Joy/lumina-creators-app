"""Creator-database CSV export (admin).

Column set mirrors the reference platform's creators export so an admin can drop
the file into the same spreadsheets. A few of its columns describe subsystems we
deliberately don't have (collections, tags, contracts, GMV as distinct from
earnings) — those are emitted with the same placeholder text the reference export
uses rather than being dropped, so the column layout stays compatible.
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import _now
from app.models import Campaign, CampaignParticipation, Creator, CreatorProfile, SocialAccount, Submission

HEADER = [
    "Name", "Email", "Phone", "Profile Details", "Post Activity", "Views Trend",
    "Accounts", "GMV", "Campaigns", "Collections", "Tags", "Created At",
    "Status", "Performance", "Total Earnings", "Contracts",
]

# "Post activity" is expressed as posts-in-the-last-N-days, like the reference.
ACTIVITY_WINDOW_DAYS = 5


def _money(v: Decimal | None) -> str:
    return f"${Decimal(v or 0):.2f}"


def _profile_details(p: CreatorProfile | None) -> str:
    if p is None:
        return "Not provided"
    bits = []
    if p.city or p.country:
        bits.append("Location: " + ", ".join(x for x in (p.city, p.country) if x))
    if p.gender:
        bits.append(f"Gender: {p.gender}")
    if p.primary_language:
        bits.append(f"Language: {p.primary_language}")
    return "; ".join(bits) or "Not provided"


def export_rows(db: Session) -> tuple[list[str], list[list]]:
    """(header, rows) for every creator. Aggregates are pre-computed in grouped
    queries rather than per-creator lookups, so the export stays one pass."""
    since = _now() - timedelta(days=ACTIVITY_WINDOW_DAYS)

    # submissions: lifetime totals + how many landed inside the activity window
    sub_stats = {
        r.creator_id: r
        for r in db.execute(
            select(
                Submission.creator_id,
                func.count(Submission.id).label("posts"),
                func.coalesce(func.sum(Submission.views), 0).label("views"),
                func.coalesce(func.sum(Submission.estimated_amount), 0).label("earned"),
                func.count(Submission.id).filter(Submission.created_at >= since).label("recent"),
            ).group_by(Submission.creator_id)
        ).all()
    }

    # campaigns joined, and how many of those are still active
    camp_stats = {
        r.creator_id: r
        for r in db.execute(
            select(
                CampaignParticipation.creator_id,
                func.count(CampaignParticipation.id).label("total"),
                func.count(CampaignParticipation.id)
                .filter(Campaign.status == "active")
                .label("active"),
            )
            .join(Campaign, Campaign.id == CampaignParticipation.campaign_id)
            .group_by(CampaignParticipation.creator_id)
        ).all()
    }

    socials: dict = {}
    for s in db.scalars(select(SocialAccount)).all():
        socials.setdefault(s.creator_id, []).append(f"{s.platform}: {s.handle}")

    profiles = {p.creator_id: p for p in db.scalars(select(CreatorProfile)).all()}

    rows: list[list] = []
    for c in db.scalars(select(Creator).order_by(Creator.created_at.desc())).all():
        p = profiles.get(c.id)
        sub = sub_stats.get(c.id)
        camp = camp_stats.get(c.id)

        posts = sub.posts if sub else 0
        views = int(sub.views) if sub else 0
        earned = Decimal(sub.earned) if sub else Decimal(0)
        recent = sub.recent if sub else 0
        camp_total = camp.total if camp else 0
        camp_active = camp.active if camp else 0

        rows.append([
            (p.display_name if p else None) or "",
            c.email,
            (p.phone if p else None) or "",
            _profile_details(p),
            f"{recent}/{ACTIVITY_WINDOW_DAYS} days active",
            f"{views:,} views" if views else "No data",
            ", ".join(socials.get(c.id, [])) or "None",
            f"{_money(earned)} total",
            f"{camp_total} total, {camp_active} active",
            "None",   # collections — not a concept in this app
            "None",   # tags — not a concept in this app
            c.created_at.strftime("%-m/%-d/%y") if c.created_at else "",
            "Active" if recent else "Inactive",
            f"{posts} posts" if posts else "N/A",
            _money(earned),
            f"{camp_total} total, {camp_active} active",   # contracts == campaign participations
        ])

    return HEADER, rows
