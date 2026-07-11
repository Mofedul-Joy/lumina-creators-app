#!/usr/bin/env python3
"""Backfill thumbnail_url for submissions that predate inline thumbnail resolution.

Submissions used to get a thumbnail only from the scrape worker, so any post
whose scrape job hadn't run yet showed an empty card. create_submission() now
resolves one inline; this fills in the rows created before that.

    python scripts/backfill_submission_thumbnails.py [--dry-run]
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import load_dotenv  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

load_dotenv()

from app.db.session import get_engine  # noqa: E402
from app.integrations import apify  # noqa: E402
from app.models import Submission  # noqa: E402


def main() -> None:
    dry = "--dry-run" in sys.argv
    with Session(get_engine()) as db:
        rows = db.scalars(select(Submission).where(Submission.thumbnail_url.is_(None))).all()
        print(f"{len(rows)} submission(s) with no thumbnail")
        for sub in rows:
            try:
                thumb = apify.fast_thumbnail(sub.platform, sub.post_url)
            except Exception as e:  # noqa: BLE001
                print(f"  {sub.id} [{sub.platform}] ERROR {e.__class__.__name__}")
                continue
            if not thumb:
                print(f"  {sub.id} [{sub.platform}] no thumbnail found — {sub.post_url}")
                continue
            print(f"  {sub.id} [{sub.platform}] -> {thumb[:80]}…")
            if not dry:
                sub.thumbnail_url = thumb
        if dry:
            print("dry run — nothing written")
            return
        db.commit()
        print("done")


if __name__ == "__main__":
    main()
