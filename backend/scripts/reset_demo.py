"""Wipe all creator/campaign/submission test data and seed realistic demo
campaigns. Preserves admin + client accounts. Idempotent-ish: safe to re-run
(it clears content tables each time).

Usage:  .venv/bin/python scripts/reset_demo.py
Guard:  refuses to run unless --yes is passed (it deletes data).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import _now
from app.db.session import get_engine
from app.models import Campaign

# Child-first delete order so FKs never block. creator_profiles.avatar_object_id
# references storage_objects, so profiles must go BEFORE storage_objects.
CLEAR_ORDER = [
    "scrape_jobs", "submissions", "campaign_participations",
    "payout_items", "payouts", "portfolio_items", "social_accounts",
    "creator_profiles", "storage_objects", "audit_log", "campaigns",
    "creators", "refresh_tokens",
]

DEMO_CAMPAIGNS = [
    {
        "name": "Nova Energy — Launch Hype", "brand_name": "Nova Energy",
        "mode": "create_new", "cpm_rate": 2.50, "budget": 8000,
        "platforms": ["tiktok", "instagram"], "link_client": True,
        "description": "Kick off the Nova Energy launch with high-energy vertical UGC.",
        "brief_script": "Film a punchy 20-30s clip cracking open a Nova can mid-activity (gym, skate, study grind). Hook in the first 2 seconds. Show the can clearly. End on the tagline: 'Fuel the grind.'",
        "caption_rules": "Tag @drinknova and #FuelTheGrind. No competitor drinks in frame.",
    },
    {
        "name": "Bloom Skincare — GRWM Routines", "brand_name": "Bloom Skincare",
        "mode": "create_new", "cpm_rate": 3.00, "budget": 6000,
        "platforms": ["instagram", "tiktok"], "link_client": True,
        "description": "Authentic get-ready-with-me routines featuring the Bloom serum.",
        "brief_script": "A calm, well-lit GRWM. Apply the Bloom serum as step one, say one honest line about how it feels. Keep it real, no over-scripting.",
        "caption_rules": "Mention 'gentle, fragrance-free'. Tag @bloomskin.",
    },
    {
        "name": "Pulse Audio — Unboxing Clips", "brand_name": "Pulse Audio",
        "mode": "copy_paste", "cpm_rate": 1.80, "budget": 4000,
        "platforms": ["youtube", "tiktok"], "link_client": True,
        "description": "Repost approved Pulse earbud unboxing clips to your channels.",
        "content_drive_url": "https://drive.google.com/drive/folders/demo-pulse-clips",
        "caption_rules": "Keep the on-screen Pulse logo. Tag @pulseaudio.",
    },
    {
        "name": "Drift Apparel — Street Style", "brand_name": "Drift Apparel",
        "mode": "create_new", "cpm_rate": 2.20, "budget": 5000,
        "platforms": ["instagram", "tiktok"], "link_client": False,
        "description": "Show Drift pieces styled your way in a real street setting.",
        "brief_script": "A 3-5 outfit transition using Drift pieces. Real location, natural light. Confident, fast cuts.",
        "caption_rules": "Tag @driftapparel and #DriftFits.",
    },
]


def slugify(name: str) -> str:
    return "".join(ch if ch.isalnum() else "-" for ch in name.lower()).strip("-").replace("--", "-")


def main() -> None:
    if "--yes" not in sys.argv:
        raise SystemExit("Refusing to delete data without --yes")
    db = Session(get_engine())
    try:
        admin_id = db.execute(text("select id from admins order by created_at limit 1")).scalar()
        client_id = db.execute(text("select id from clients order by created_at limit 1")).scalar()
        if admin_id is None:
            raise SystemExit("No admin found — run seed_dev.py first")

        for t in CLEAR_ORDER:
            n = db.execute(text(f"delete from {t}")).rowcount
            print(f"cleared {t}: {n}")

        now = _now()
        for c in DEMO_CAMPAIGNS:
            db.add(Campaign(
                created_by=admin_id,
                client_id=client_id if c["link_client"] else None,
                name=c["name"], slug=slugify(c["name"]),
                description=c["description"], mode=c["mode"], status="active",
                cpm_rate=c["cpm_rate"], budget=c["budget"],
                platforms=c["platforms"], min_retention_days=30,
                brief_script=c.get("brief_script"),
                content_drive_url=c.get("content_drive_url"),
                caption_rules=c.get("caption_rules"),
                brand_name=c["brand_name"], published_at=now,
            ))
            print(f"seeded campaign: {c['name']}")

        db.commit()
        print("\nDONE — demo data reset. admin/client accounts preserved.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
