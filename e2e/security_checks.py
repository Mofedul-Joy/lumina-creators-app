"""Backend security regression — covers the adversarial-review findings that the
UI E2E suites don't reach. Talks to the API directly on :8000.

Run:  python e2e/security_checks.py
"""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request

API = "http://localhost:8000"


def api(path, body=None, token=None, method=None):
    req = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method or ("POST" if body is not None else "GET"),
        headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})},
    )
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "{}")


def expect(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print("ok", msg)


def new_creator(stamp, tag):
    email = f"sec-{tag}+{stamp}@lumina.dev"
    _, r = api("/api/creator/auth/signup", {"email": email, "password": "SecPass12345!", "display_name": tag})
    return email, r["access_token"]


def finalized_object(token, stamp, purpose="portfolio_video"):
    _, pres = api("/api/creator/uploads/presign", {"purpose": purpose, "content_type": "video/mp4", "filename": "s.mp4", "size_bytes": 16}, token)
    urllib.request.urlopen(urllib.request.Request(pres["upload_url"], data=b"\x00" * 16, method="PUT"))
    _, fin = api(f"/api/creator/uploads/{pres['object_id']}/finalize", {}, token)
    return fin["id"]


def main():
    stamp = int(time.time())

    # 1. realm isolation: creator token cannot hit admin endpoints
    _, victim_tok = new_creator(stamp, "victim")[0], new_creator(stamp, "victim2")[1]
    code, _ = api("/api/admin/creators", token=victim_tok)
    expect(code == 401, "creator token rejected from admin endpoint (401)")

    # 2. IDOR: creator B cannot attach creator A's uploaded object to their portfolio
    _, tok_a = new_creator(stamp, "owner")
    _, tok_b = new_creator(stamp, "thief")
    obj_a = finalized_object(tok_a, stamp, "portfolio_video")
    code, body = api("/api/creator/profile/portfolio", {"storage_object_id": obj_a}, tok_b)
    expect(code in (403, 404), f"cross-creator portfolio attach blocked ({code})")

    # 3. purpose mismatch: an avatar object cannot be used as a portfolio item
    obj_avatar = finalized_object(tok_a, stamp, "avatar")
    code, _ = api("/api/creator/profile/portfolio", {"storage_object_id": obj_avatar}, tok_a)
    expect(code == 400, f"wrong-purpose object rejected for portfolio ({code})")

    # 4. owner can attach their own finalized portfolio object
    code, _ = api("/api/creator/profile/portfolio", {"storage_object_id": obj_a}, tok_a)
    expect(code == 200, f"owner attaches own finalized object ({code})")

    # 5. path traversal on the local upload route is rejected
    try:
        urllib.request.urlopen(urllib.request.Request(f"{API}/uploads/local/../../etc/passwd", data=b"x", method="PUT"))
        code = 200
    except urllib.error.HTTPError as e:
        code = e.code
    expect(code == 400, f"path traversal on local upload rejected ({code})")

    # 6. duplicate submission -> 409 (not 500)
    admin_tok = api("/api/admin/auth/login", {"email": "admin@lumina.dev", "password": "admin12345"})[1]["access_token"]
    _, camp = api("/api/admin/campaigns", {"name": f"Sec Camp {stamp}", "mode": "create_new", "cpm_rate": 1, "budget": 100, "brief_script": "b", "platforms": ["tiktok"]}, admin_tok)
    api(f"/api/admin/campaigns/{camp['id']}/publish", {}, admin_tok)
    # complete a creator's profile so they can join
    _, tok_c = new_creator(stamp, "submitter")
    api("/api/creator/profile", {"display_name": "S", "date_of_birth": "1995-01-01", "gender": "male", "primary_language": "English", "country": "US"}, tok_c, method="PUT")
    api("/api/creator/profile/socials", {"platform": "tiktok", "handle": f"s{stamp}", "follower_count": 1000}, tok_c)
    api("/api/creator/profile/portfolio", {"storage_object_id": finalized_object(tok_c, stamp)}, tok_c)
    api(f"/api/creator/campaigns/{camp['slug']}/join", {}, tok_c)
    url = f"https://www.tiktok.com/@s{stamp}/video/{stamp}"
    code1, _ = api("/api/creator/submissions", {"campaign_slug": camp["slug"], "post_url": url}, tok_c)
    code2, _ = api("/api/creator/submissions", {"campaign_slug": camp["slug"], "post_url": url}, tok_c)
    expect(code1 == 200 and code2 == 409, f"duplicate submission -> 409 (got {code1}, {code2})")

    # 7. invalid-token subject rejected
    code, _ = api("/api/creator/auth/me", token="not-a-jwt")
    expect(code == 401, f"garbage bearer token rejected ({code})")

    print("SECURITY CHECKS PASS")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"SECURITY CHECKS FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
