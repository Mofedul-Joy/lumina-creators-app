"""Submission URL canonicalization + hashing (the dedup rule from SCHEMA.md).

Beats tracking params, x.com/twitter.com aliases, and trailing-slash variants so
UNIQUE(campaign_id, url_hash) actually stops duplicate submissions.
"""
from __future__ import annotations

import hashlib
from urllib.parse import urlparse, urlunparse

_PLATFORM_HOST = {
    "instagram.com": "instagram",
    "tiktok.com": "tiktok",
    "youtube.com": "youtube",
    "youtu.be": "youtube",
    "twitter.com": "twitter",
    "x.com": "twitter",
    "facebook.com": "facebook",
    "fb.watch": "facebook",
}
# Host aliases collapsed to one canonical host before hashing.
_HOST_ALIAS = {"x.com": "twitter.com", "www.x.com": "twitter.com"}


def _bare_host(netloc: str) -> str:
    host = netloc.lower().split("@")[-1].split(":")[0]
    return host[4:] if host.startswith("www.") else host


def canonicalize_url(raw: str) -> str:
    """Lowercase host, drop query/fragment and 'www', strip trailing slash."""
    p = urlparse(raw.strip())
    if not p.scheme:
        p = urlparse("https://" + raw.strip())
    host = _bare_host(p.netloc)
    host = _HOST_ALIAS.get(host, host)
    path = p.path.rstrip("/") or "/"
    return urlunparse(("https", host, path, "", "", ""))


def url_hash(raw: str) -> str:
    return hashlib.sha256(canonicalize_url(raw).encode("utf-8")).hexdigest()


def detect_platform(raw: str) -> str | None:
    host = _bare_host(urlparse(canonicalize_url(raw)).netloc)
    return _PLATFORM_HOST.get(host)


def _demo() -> None:
    # Same post via different aliases / params / slashes -> same hash.
    variants = [
        "https://twitter.com/user/status/123",
        "https://x.com/user/status/123?s=20&t=abc",
        "http://www.x.com/user/status/123/",
        "x.com/user/status/123",
    ]
    hashes = {url_hash(v) for v in variants}
    assert len(hashes) == 1, f"aliases should collapse, got {len(hashes)}"
    # Different posts -> different hash.
    assert url_hash("https://tiktok.com/@a/video/1") != url_hash("https://tiktok.com/@a/video/2")
    assert detect_platform("https://youtu.be/xyz") == "youtube"
    assert detect_platform("https://x.com/a/status/1") == "twitter"
    assert detect_platform("https://example.com/x") is None
    print("urls self-check: PASS")


if __name__ == "__main__":
    _demo()
