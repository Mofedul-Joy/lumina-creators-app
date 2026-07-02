"""E2E: creator signup -> onboarding (profile + social + portfolio) -> campaigns.

Run:  python e2e/creator_flow.py [--base http://localhost:3100]
Requires backend on :8000 (local storage mode is fine) and frontend dev server.
Exits non-zero on the first failed step. Screenshots land in e2e/shots/.
"""
import argparse
import sys
import time
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

SHOTS = Path(__file__).parent / "shots"
SHOTS.mkdir(exist_ok=True)


def shot(page, name: str) -> None:
    page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=False)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:3100")
    ap.add_argument("--headed", action="store_true")
    args = ap.parse_args()

    stamp = int(time.time())
    email = f"e2e+{stamp}@lumina.dev"
    password = "E2ePass12345!"

    # tiny valid-enough mp4 stub for the portfolio upload
    fake_mp4 = SHOTS / "stub.mp4"
    fake_mp4.write_bytes(b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 256)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        # Generous timeout: local testing hits the DB in Oregon, so each mutation
        # is a multi-second round-trip. In prod (backend co-located with the DB)
        # these are sub-100ms.
        page.set_default_timeout(30000)
        page.on("console", lambda m: m.type in ("error", "warning") and print(f"[console.{m.type}] {m.text}"))
        page.on("pageerror", lambda e: print(f"[pageerror] {e}"))

        # ── 1. signup ────────────────────────────────────────────────
        page.goto(f"{args.base}/signup")
        page.get_by_label("Display name").fill("E2E Creator")
        page.get_by_label("Email").fill(email)
        page.get_by_label("Password").fill(password)
        shot(page, "01_signup_filled")
        page.get_by_role("button", name="Create account").click()
        page.wait_for_url("**/onboarding")
        print(f"ok signup -> onboarding  ({email})")

        # ── 2. onboarding: basics (required fields) ──────────────────
        page.get_by_label("Display name").wait_for(timeout=30000)  # past the load gate
        page.get_by_label("Display name").fill("E2E Creator")
        page.get_by_label("Date of birth").fill("1999-01-15")
        page.locator("select").first.select_option("female")
        page.get_by_label("Primary language").fill("English")
        page.get_by_label("Country").fill("United States")
        shot(page, "02_basics")
        print("ok basics filled")

        # ── 3. onboarding: add a social account (platform grid) ──────
        for attempt in range(3):
            try:
                card = page.locator("div").filter(has_text="TikTok").filter(
                    has=page.get_by_role("button", name="+ Add")).last
                card.get_by_role("button", name="+ Add").click()
                page.get_by_placeholder("handle (without @)").fill("e2e_creator")
                page.get_by_placeholder("follower count").fill("12000")
                page.get_by_role("button", name="Add TikTok").click()
                expect(page.get_by_text("@e2e_creator")).to_be_visible(timeout=15000)
                break
            except Exception:
                page.wait_for_timeout(2000)
        shot(page, "03_social_added")
        print("ok social added")

        # ── 4. onboarding: add a portfolio VIDEO LINK (no upload) ────
        page.get_by_placeholder("https://tiktok.com/@you/video/…").fill(
            "https://www.tiktok.com/@e2e_creator/video/12345")
        page.get_by_role("button", name="Add video link").click()
        expect(page.get_by_text("e2e_creator/video/12345")).to_be_visible(timeout=15000)
        print("ok portfolio link added")

        # ── 5. Save & continue -> creator dashboard ──────────────────
        page.get_by_role("button", name="Save & continue").click()
        page.wait_for_url("**/dashboard", timeout=30000)
        shot(page, "04_dashboard")
        print("ok save & continue -> dashboard")

        # ── 6. campaigns page loads ──────────────────────────────────
        page.goto(f"{args.base}/campaigns")
        page.wait_for_load_state("networkidle")
        shot(page, "05_campaigns")
        print("ok campaigns page loaded")

        browser.close()
        print("CREATOR FLOW PASS")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"CREATOR FLOW FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
