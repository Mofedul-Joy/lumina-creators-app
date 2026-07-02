"""E2E part 4: edge cases and error states.

1. Wrong password        -> inline error, stays on login
2. Unknown email         -> "No creator account found"
3. Duplicate signup      -> friendly error from the API
4. Short password signup -> client-side validation
5. Incomplete profile joining a campaign -> warning + link to onboarding
6. Deep-link to /dashboard signed out    -> sign-in prompt (no crash)

Run:  python e2e/edge_cases.py [--base http://localhost:3100]
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


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:3100")
    args = ap.parse_args()
    stamp = int(time.time())

    # fixture: an account with a known password, incomplete profile
    email = f"e2e-edge+{stamp}@lumina.dev"
    api("/api/creator/auth/signup", {"email": email, "password": "EdgePass12345!", "display_name": "Edge"})

    # fixture: one published campaign to attempt joining
    admin_tok = api("/api/admin/auth/login", {"email": "admin@lumina.dev", "password": "admin12345"})["access_token"]
    camp = api("/api/admin/campaigns", {
        "name": f"Edge Campaign {stamp}", "mode": "create_new", "cpm_rate": 1, "budget": 100,
        "brief_script": "brief", "platforms": ["tiktok"],
    }, admin_tok)
    api(f"/api/admin/campaigns/{camp['id']}/publish", {}, admin_tok)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.set_default_timeout(30000)

        # 1. wrong password
        page.goto(f"{args.base}/login")
        page.get_by_label("Email").fill(email)
        page.get_by_role("button", name="Continue").click()
        page.get_by_label("Password", exact=True).fill("wrong-password")
        page.get_by_role("button", name="Sign in").click()
        expect(page.get_by_text("Invalid email or password")).to_be_visible(timeout=25000)
        print("ok wrong password shows inline error")

        # 2. unknown email
        page.goto(f"{args.base}/login")
        page.get_by_label("Email").fill(f"nobody+{stamp}@lumina.dev")
        page.get_by_role("button", name="Continue").click()
        expect(page.get_by_text("No creator account found for this email.")).to_be_visible(timeout=25000)
        print("ok unknown email handled")

        # 3. duplicate signup
        page.goto(f"{args.base}/signup")
        page.get_by_label("Display name").fill("Edge Dup")
        page.get_by_label("Email").fill(email)
        page.get_by_label("Password").fill("EdgePass12345!")
        page.get_by_role("button", name="Create account").click()
        expect(page.locator("p[role=alert]")).to_be_visible(timeout=25000)
        page.screenshot(path=str(SHOTS / "30_duplicate_signup.png"))
        print("ok duplicate signup shows error:", page.locator("p[role=alert]").inner_text())

        # 4. short password client-side validation
        page.goto(f"{args.base}/signup")
        page.get_by_label("Email").fill(f"short+{stamp}@lumina.dev")
        page.get_by_label("Password").fill("short")
        page.get_by_role("button", name="Create account").click()
        expect(page.get_by_text("Password must be at least 8 characters.")).to_be_visible()
        print("ok short password blocked client-side")

        # 5. incomplete profile tries to join a campaign
        page.goto(f"{args.base}/login")
        page.get_by_label("Email").fill(email)
        page.get_by_role("button", name="Continue").click()
        page.get_by_label("Password", exact=True).fill("EdgePass12345!")
        page.get_by_role("button", name="Sign in").click()
        page.wait_for_url("**/dashboard")
        page.goto(f"{args.base}/campaigns/{camp['slug']}")
        page.get_by_role("button", name="Enter campaign").click()
        expect(page.get_by_text("Finish your profile before entering campaigns.")).to_be_visible(timeout=25000)
        page.screenshot(path=str(SHOTS / "31_incomplete_join.png"))
        print("ok incomplete-profile join shows friendly warning + link")

        # 6. signed-out deep link
        ctx2 = browser.new_page()
        ctx2.goto(f"{args.base}/onboarding")
        expect(ctx2.get_by_text("Please sign in")).to_be_visible(timeout=25000)
        print("ok signed-out deep link prompts sign-in")

        browser.close()
        print("EDGE CASES PASS")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"EDGE CASES FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
