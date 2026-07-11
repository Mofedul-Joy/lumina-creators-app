"""Re-host remote post thumbnails on our own storage.

Storing the platform's CDN URL does not work. Instagram's scontent.cdninstagram
URLs are signed and short-lived (`oe=` expiry) AND hotlink-blocked: the browser
gets a 403 / cross-origin block, and even a server-side re-fetch 403s once the
signature ages. A stored CDN link is therefore a thumbnail that renders for
nobody.

So the moment we resolve a thumbnail — while the URL is still fresh — we
download the bytes and put them in our own bucket, and store OUR url. That also
means the image can't rot later.
"""
from __future__ import annotations

import logging
import uuid
from typing import Optional

import httpx

from app.core.config import get_settings
from app.integrations import storage

log = logging.getLogger(__name__)

# Generous enough for any post thumbnail, small enough that a hostile URL can't
# make us buffer something huge.
MAX_BYTES = 8 * 1024 * 1024
_EXT = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
_BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)


def is_self_hosted(url: Optional[str]) -> bool:
    """True only if `url` is served by THIS deployment's storage.

    Deliberately not a "/uploads/" substring test: a URL written by a dev box
    (http://localhost:8000/uploads/...) also contains that, and treating it as
    ours would leave an unreachable link in the shared database forever.
    """
    if not url:
        return False
    s = get_settings()
    bases = [s.api_public_url, s.r2_public_base]
    return any(b and url.startswith(b.rstrip("/")) for b in bases)


def rehost(url: Optional[str], purpose: str, owner_id) -> Optional[str]:
    """Download `url` and store it on our own storage; return our public URL.

    Returns None (never raises, never partially writes) if anything goes wrong —
    callers treat a missing thumbnail as "render the fallback card", which is
    always better than failing the request that triggered this.
    """
    if not url:
        return None
    if is_self_hosted(url):
        return url

    try:
        with httpx.Client(timeout=15, follow_redirects=True) as client:
            r = client.get(url, headers={"User-Agent": _BROWSER_UA})
            if r.status_code != 200:
                log.info("thumbnail rehost: %s returned %s", url[:80], r.status_code)
                return None
            ctype = (r.headers.get("content-type") or "").split(";")[0].strip().lower()
            if not ctype.startswith("image/"):
                log.info("thumbnail rehost: %s is not an image (%s)", url[:80], ctype)
                return None
            data = r.content
            if not data or len(data) > MAX_BYTES:
                return None
    except Exception as exc:  # noqa: BLE001 - best-effort, never block the caller
        log.info("thumbnail rehost failed for %s: %s", url[:80], exc)
        return None

    ext = _EXT.get(ctype, "jpg")
    key = storage.make_object_key(purpose, owner_id or uuid.uuid4(), f"thumb.{ext}")
    try:
        storage.put_object_bytes(key, data, ctype)
    except Exception as exc:  # noqa: BLE001
        log.warning("thumbnail rehost: storage write failed: %s", exc)
        return None
    return storage.object_public_url(key)
