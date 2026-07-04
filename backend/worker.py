"""Background worker entrypoint (Render Background Worker, not a web dyno).

Polls `scrape_jobs` for due rows and processes them in Apify-actor batches.
Run as its own Render service pointed at the same DATABASE_URL as the API —
see render.yaml. Not exposed to the internet; no HTTP server here.
"""
from __future__ import annotations

import logging
import time

from app.core.config import get_settings
from app.db.session import get_db
from app.services.scrape_worker import process_due_jobs

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("worker")

IDLE_SLEEP_SEC = 15


def main() -> None:
    settings = get_settings()
    if not settings.apify_configured:
        log.warning("APIFY_API_TOKEN is not set — worker will idle without scraping anything")

    log.info("scrape worker starting (poll every %ss when idle)", IDLE_SLEEP_SEC)
    while True:
        db = next(get_db())
        processed = 0
        try:
            processed = process_due_jobs(db)
            if processed:
                log.info("processed %d scrape job(s)", processed)
        except Exception:  # noqa: BLE001 - keep the loop alive across transient errors
            log.exception("worker tick failed")
        finally:
            db.close()
        time.sleep(1 if processed else IDLE_SLEEP_SEC)


if __name__ == "__main__":
    main()
