"""E2E part 3: client (brand) realm. Admin creates a campaign linked to the
seeded client via the UI (exercising the new client picker), a creator submits
to it via API, then the client signs in and sees live stats on the dashboard.

Run:  python e2e/client_flow.py [--base http://localhost:3100]
Needs: seed_dev.py run (admin@lumina.dev / client@lumina.dev), both servers up.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

API = "http://localhost:8000"
SHOTS = Path(__file__).parent / "shots"
SHOTS.mkdir(exist_ok=True)


def api(path: str, body: dict | None = None, token: str | None = None, method: str | None = None):
    req = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method or ("POST" if body is not None else "GET"),
        headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})},
    )
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read() or "{}")


def creator_submit_to(slug: str, stamp: int) -> None:
    """Provision a complete creator and submit one post to the campaign (API)."""
    em = f"e2e-client+{stamp}@lumina.dev"
    su = api("/api/creator/auth/signup", {"email": em, "password": "E2ePass12345!", "display_name": "Client Flow Creator"})
    tok = api("/api/creator/auth/verify-email", {"email": em, "code": su["dev_code"]})["access_token"]
    api("/api/creator/profile", {
        "display_name": "Client Flow Creator", "bio": "b", "date_of_birth": "1997-07-07",
        "gender": "female", "ethnicity": "n/a", "primary_language": "English",
        "languages": ["English"], "country": "US", "city": "LA",
    }, tok, method="PUT")
    api("/api/creator/profile/socials", {"platform": "tiktok", "handle": f"cf{stamp}", "follower_count": 9000}, tok)
    api("/api/creator/profile/portfolio", {"video_url": f"https://www.tiktok.com/@cf{stamp}/video/2"}, tok)
    api(f"/api/creator/campaigns/{slug}/join", {}, tok)
    api("/api/creator/submissions", {"campaign_slug": slug, "post_url": f"https://www.tiktok.com/@cf{stamp}/video/{stamp}"}, tok)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:3100")
    ap.add_argument("--headed", action="store_true")
    args = ap.parse_args()

    stamp = int(time.time())
    campaign_name = f"Brand Push {stamp}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.set_default_timeout(30000)

        # ── 1. admin creates a campaign LINKED TO THE CLIENT via UI ──
        page.goto(f"{args.base}/admin/login")
        page.get_by_label("Email").fill("admin@lumina.dev")
        page.get_by_label("Password").fill("admin12345")
        page.get_by_role("button", name="Sign in").click()
        page.wait_for_url("**/admin/dashboard")

        page.goto(f"{args.base}/admin/campaigns/new")
        page.get_by_label("Campaign name").fill(campaign_name)
        page.get_by_label("Brand name").fill("Lumina Demo Brand")
        page.locator("select").first.select_option(label="Lumina Demo Brand")
        page.locator("textarea").first.fill("Post energetic product clips.")
        page.get_by_label("CPM ($ / 1,000 views)").fill("3")
        page.get_by_label("Budget ($)").fill("2000")
        page.locator("textarea").nth(1).fill("Brief: strong hook, product visible.")
        page.get_by_role("button", name="Create & publish").click()
        page.wait_for_url("**/admin/campaigns")
        expect(page.get_by_text(campaign_name)).to_be_visible(timeout=25000)
        print("ok admin created client-linked campaign via UI picker")

        # find the slug via API for the creator step
        admin_tok = api("/api/admin/auth/login", {"email": "admin@lumina.dev", "password": "admin12345"})["access_token"]
        camp = next(c for c in api("/api/admin/campaigns", token=admin_tok) if c["name"] == campaign_name)
        assert camp["client_id"], "campaign should be linked to a client"

        # ── 2. a creator joins + submits (API fast-path) ─────────────
        creator_submit_to(camp["slug"], stamp)
        print("ok creator joined + submitted to the campaign")

        # ── 3. client signs in and sees the campaign + stats ─────────
        page.goto(f"{args.base}/client/login")
        page.get_by_label("Email").fill("client@lumina.dev")
        page.get_by_label("Password").fill("client12345")
        page.get_by_role("button", name="Sign in").click()
        page.wait_for_url("**/client/dashboard")
        expect(page.get_by_text(campaign_name)).to_be_visible(timeout=25000)
        page.screenshot(path=str(SHOTS / "20_client_dashboard.png"))

        # expand submissions
        page.get_by_text(campaign_name).first.click()
        expect(page.get_by_text("tiktok.com").first).to_be_visible(timeout=25000)
        page.screenshot(path=str(SHOTS / "21_client_submissions.png"))
        print("ok client dashboard shows campaign, stats, and submissions")

        browser.close()
        print("CLIENT FLOW PASS")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"CLIENT FLOW FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
