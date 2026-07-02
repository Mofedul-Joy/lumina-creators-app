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


# Canonical profile-URL shape per platform ({h} = handle without a leading @).
_PROFILE_URL = {
    "instagram": "https://instagram.com/{h}",
    "tiktok": "https://www.tiktok.com/@{h}",
    "youtube": "https://youtube.com/@{h}",
    "twitter": "https://x.com/{h}",
    "facebook": "https://facebook.com/{h}",
}


def social_profile_url(platform: str, handle: str) -> str:
    """Build the canonical profile URL from platform + handle."""
    return _PROFILE_URL[platform].format(h=handle.lstrip("@").strip())


def url_is_platform(platform: str, url: str) -> bool:
    """True if `url` actually points at `platform` (not a random/phishing link)."""
    return detect_platform(url) == platform


# Path markers that make a platform URL an actual video/post, not a bare domain
# or profile page. Lightweight on purpose — full API verification isn't worth it.
_VIDEO_MARKERS = {
    "tiktok": ("/video/", "/photo/", "/t/", "/v/"),
    "youtube": ("watch", "/shorts/", "/embed/", "youtu.be/"),
    "instagram": ("/reel", "/p/", "/tv/"),
    "twitter": ("/status/",),
    "facebook": ("/watch", "/videos/", "/reel", "/share/"),
}


def is_video_url(url: str) -> bool:
    """A real video/post link on a supported platform (rejects bare-domain links)."""
    plat = detect_platform(url)
    if plat is None:
        return False
    low = url.lower()
    return any(tok in low for tok in _VIDEO_MARKERS.get(plat, ()))


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
    # social profile URL construction + platform match
    assert social_profile_url("tiktok", "@nova") == "https://www.tiktok.com/@nova"
    assert url_is_platform("twitter", "https://x.com/nova")
    assert not url_is_platform("tiktok", "https://instagram.com/nova")
    assert not url_is_platform("instagram", "https://evil.com/phish")
    # video-URL detection: real posts pass, bare domains / profiles fail
    assert is_video_url("https://www.tiktok.com/@nova/video/123")
    assert is_video_url("https://youtu.be/abc123")
    assert is_video_url("https://instagram.com/reel/xyz")
    assert not is_video_url("https://tiktok.com/")
    assert not is_video_url("https://www.tiktok.com/@nova")  # profile, not a video
    assert not is_video_url("https://evil.com/video/1")
    print("urls self-check: PASS")


if __name__ == "__main__":
    _demo()
