"""Additive demo data for the admin Analytics page: named creators who joined
campaigns and posted submissions with views/likes across the last 30 days.

Does NOT wipe anything (safe to run alongside real test accounts). Idempotent:
skips creators that already exist by email.

Usage:  .venv/bin/python scripts/seed_analytics_demo.py
"""
import hashlib
import random
import sys
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.security import _now, hash_password  # noqa: E402
from app.db.session import get_engine  # noqa: E402
from app.models import Campaign, CampaignParticipation, Creator, CreatorProfile, Submission  # noqa: E402

random.seed(42)  # reproducible demo

CREATORS = [
    ("ava.stone.demo@lumina.dev", "Ava Stone", "United States"),
    ("marcus.lee.demo@lumina.dev", "Marcus Lee", "United Kingdom"),
    ("priya.nair.demo@lumina.dev", "Priya Nair", "Canada"),
    ("diego.torres.demo@lumina.dev", "Diego Torres", "Mexico"),
    ("sofia.kim.demo@lumina.dev", "Sofia Kim", "Australia"),
    ("liam.walsh.demo@lumina.dev", "Liam Walsh", "Ireland"),
]


def main() -> None:
    db = Session(get_engine())
    try:
        now = _now()
        campaigns = db.scalars(select(Campaign)).all()
        if not campaigns:
            raise SystemExit("No campaigns — run reset_demo.py first")

        subs_made = 0
        for email, name, country in CREATORS:
            existing = db.scalar(select(Creator).where(Creator.email == email))
            if existing:
                print(f"skip existing creator: {name}")
                continue
            creator = Creator(email=email, password_hash=hash_password("Demo12345!"),
                              status="active", signup_source="self", email_verified=True)
            db.add(creator)
            db.flush()  # get creator.id
            db.add(CreatorProfile(
                creator_id=creator.id, display_name=name, country=country,
                primary_language="English", gender="other",
                completed_at=now - timedelta(days=random.randint(20, 40)),
            ))

            # each creator joins 1-2 random campaigns and posts a few clips
            for camp in random.sample(campaigns, k=random.randint(1, 2)):
                part = CampaignParticipation(campaign_id=camp.id, creator_id=creator.id,
                                             status="joined", joined_at=now - timedelta(days=25))
                db.add(part)
                db.flush()
                platform = camp.platforms[0] if camp.platforms else "tiktok"
                for _ in range(random.randint(2, 5)):
                    # weighted views: mostly modest, occasionally viral
                    views = int(random.choice([1, 1, 1, 1, 3, 8]) * random.randint(4000, 90000))
                    likes = int(views * random.uniform(0.03, 0.09))
                    comments = int(views * random.uniform(0.003, 0.012))
                    est = (Decimal(views) / 1000 * camp.cpm_rate).quantize(Decimal("0.0001"))
                    age = random.randint(0, 29)
                    url = f"https://{platform}.example/{creator.id.hex[:8]}/{random.randint(10**9, 10**10)}"
                    db.add(Submission(
                        participation_id=part.id, campaign_id=camp.id, creator_id=creator.id,
                        post_url=url, canonical_url=url,
                        url_hash=hashlib.sha256(url.encode()).hexdigest(),
                        platform=platform, views=views, likes=likes, comments=comments,
                        cpm_rate_snapshot=camp.cpm_rate, estimated_amount=est,
                        verification_status=random.choice(["verified", "verified", "pending"]),
                        scrape_status="success",
                        created_at=now - timedelta(days=age, hours=random.randint(0, 23)),
                    ))
                    subs_made += 1
            print(f"seeded creator: {name}")

        db.commit()
        print(f"\nDONE — added demo creators + {subs_made} submissions for analytics.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
