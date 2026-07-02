"""E2E part 2: admin creates+publishes a campaign, then a fresh creator joins
it and submits a post. Run AFTER creator_flow.py (any time — it self-provisions
its own creator via the API for speed, exercising the UI where it matters).

Run:  python e2e/admin_and_join_flow.py [--base http://localhost:3100]
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
        headers={
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read() or "{}")


def provision_complete_creator(stamp: int) -> tuple[str, str, str]:
    """Create a creator with a complete profile via the API (UI path already
    covered by creator_flow.py). Returns (email, password, token)."""
    email = f"e2e-join+{stamp}@lumina.dev"
    password = "E2ePass12345!"
    su = api("/api/creator/auth/signup", {"email": email, "password": password, "display_name": "Join Tester"})
    tok = api("/api/creator/auth/verify-email", {"email": email, "code": su["dev_code"]})["access_token"]
    api("/api/creator/profile", {
        "display_name": "Join Tester", "bio": "bio", "date_of_birth": "1998-04-02",
        "gender": "male", "ethnicity": "n/a", "primary_language": "English",
        "languages": ["English"], "country": "US", "city": "NYC",
    }, tok, method="PUT")
    api("/api/creator/profile/socials", {"platform": "tiktok", "handle": f"join{stamp}", "follower_count": 5000}, tok)
    api("/api/creator/profile/portfolio", {"video_url": f"https://www.tiktok.com/@join{stamp}/video/1", "brand_name": "X"}, tok)
    completion = api("/api/creator/profile/completion", token=tok)
    assert completion["completed"], f"profile not complete: {completion}"
    return email, password, tok


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:3100")
    ap.add_argument("--headed", action="store_true")
    args = ap.parse_args()

    stamp = int(time.time())
    campaign_name = f"E2E Launch {stamp}"
    creator_email, creator_password, _ = provision_complete_creator(stamp)
    print(f"ok provisioned complete creator {creator_email}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.set_default_timeout(30000)

        # ── 1. admin login ───────────────────────────────────────────
        page.goto(f"{args.base}/admin/login", wait_until="networkidle")
        page.get_by_label("Email").fill("admin@lumina.dev")
        page.get_by_label("Password").fill("admin12345")
        try:
            page.get_by_role("button", name="Sign in").click()
            page.wait_for_url("**/admin/dashboard", timeout=25000)
        except Exception:
            page.screenshot(path=str(SHOTS / "10_admin_login_FAIL.png"))
            raise
        page.wait_for_load_state("networkidle")
        page.screenshot(path=str(SHOTS / "10_admin_home.png"))
        print("ok admin login")

        # ── 2. creators database shows our creators ──────────────────
        page.goto(f"{args.base}/admin/creators")
        try:
            expect(page.get_by_text("Join Tester").first).to_be_visible(timeout=25000)
        except Exception:
            page.screenshot(path=str(SHOTS / "11_admin_creators_FAIL.png"))
            raise
        page.screenshot(path=str(SHOTS / "11_admin_creators.png"))
        print("ok creators database lists the new creator")

        # ── 3. create + publish a campaign ───────────────────────────
        page.goto(f"{args.base}/admin/campaigns/new")
        page.get_by_label("Campaign name").fill(campaign_name)
        page.get_by_label("Brand name").fill("Lumina Demo Brand")
        page.locator("textarea").first.fill("Film a 30s vertical unboxing with strong hook.")
        page.get_by_label("CPM ($ / 1,000 views)").fill("2.5")
        page.get_by_label("Budget ($)").fill("5000")
        page.get_by_role("button", name="instagram", exact=True).click()  # add IG next to default tiktok
        page.locator("textarea").nth(1).fill("Hook in first 2 seconds. No music with copyright.")
        page.screenshot(path=str(SHOTS / "12_campaign_form.png"))
        page.get_by_role("button", name="Create & publish").click()
        page.wait_for_url("**/admin/campaigns")
        expect(page.get_by_text(campaign_name)).to_be_visible(timeout=25000)
        page.screenshot(path=str(SHOTS / "13_campaign_published.png"))
        print("ok campaign created + published")

        # ── 4. creator sees it, joins, submits ───────────────────────
        page.goto(f"{args.base}/login")
        page.get_by_label("Email").fill(creator_email)
        page.get_by_role("button", name="Continue").click()
        page.get_by_label("Password", exact=True).fill(creator_password)
        page.get_by_role("button", name="Sign in").click()
        page.wait_for_url("**/dashboard")
        print("ok creator login via email->password steps")

        page.goto(f"{args.base}/campaigns")
        expect(page.get_by_text(campaign_name)).to_be_visible(timeout=25000)
        page.screenshot(path=str(SHOTS / "14_creator_campaigns.png"))
        page.get_by_text(campaign_name).first.click()
        page.wait_for_load_state("networkidle")

        page.get_by_role("button", name="Enter campaign").click()
        expect(page.get_by_label("Post URL")).to_be_visible(timeout=25000)
        page.get_by_label("Post URL").fill("https://www.tiktok.com/@join/video/123456789")
        page.get_by_role("button", name="Submit post").click()
        expect(page.get_by_text("Submitted — we’ll track the views.")).to_be_visible(timeout=25000)
        page.screenshot(path=str(SHOTS / "15_submitted.png"))
        print("ok joined campaign and submitted a post")

        # ── 5. the submission shows on the My submissions page ───────
        page.goto(f"{args.base}/submissions")
        expect(page.get_by_role("heading", name="My submissions")).to_be_visible(timeout=25000)
        expect(page.get_by_text(campaign_name).first).to_be_visible(timeout=25000)
        page.screenshot(path=str(SHOTS / "16_submissions.png"))
        print("ok submission appears on My submissions page")

        browser.close()
        print("ADMIN+JOIN FLOW PASS")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"ADMIN+JOIN FLOW FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
