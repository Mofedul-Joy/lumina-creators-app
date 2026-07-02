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
        page.set_default_timeout(15000)
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

        # ── 2. onboarding: basics ────────────────────────────────────
        expect(page.get_by_text("Still needed to finish your profile:")).to_be_visible()
        page.get_by_label("Display name").fill("E2E Creator")
        page.locator("textarea").first.fill("UGC creator for E2E testing.")
        page.get_by_label("Date of birth").fill("1999-01-15")
        page.locator("select").first.select_option("female")
        page.get_by_label("Primary language").fill("English")
        page.get_by_label("Ethnicity").fill("Prefer not to say")
        page.get_by_label("Country").fill("United States")
        page.get_by_label("City", exact=True).fill("Austin")
        page.get_by_role("button", name="Save", exact=True).click()
        page.wait_for_timeout(1500)
        shot(page, "02_basics_saved")
        print("ok basics saved")

        # ── 3. onboarding: social account ────────────────────────────
        page.get_by_label("Handle").fill("e2e_creator")
        page.get_by_label("Profile URL").fill("https://instagram.com/e2e_creator")
        page.get_by_label("Followers").fill("12000")
        page.get_by_role("button", name="Add", exact=True).click()
        expect(page.get_by_text("instagram · @e2e_creator")).to_be_visible()
        shot(page, "03_social_added")
        print("ok social added")

        # ── 4. onboarding: portfolio video (local storage fallback) ──
        page.get_by_label("Brand name").fill("Demo Brand")
        page.get_by_label("Caption").fill("30s vertical cut")
        page.locator('input[type="file"][accept="video/*"]').set_input_files(str(fake_mp4))
        try:
            expect(page.get_by_text("Demo Brand")).to_be_visible(timeout=20000)
        except Exception:
            shot(page, "04_portfolio_FAIL")
            raise
        page.wait_for_timeout(2500)  # completion banner refetch
        expect(page.get_by_text("Profile complete — you can enter campaigns.")).to_be_visible()
        shot(page, "04_profile_complete")
        print("ok portfolio uploaded, profile complete")

        # ── 5. campaigns page loads ──────────────────────────────────
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
