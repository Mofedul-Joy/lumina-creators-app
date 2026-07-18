"""Lightweight in-process sliding-window login throttling.

This is process-local memory, which is fine for the current single-instance
Render deploy. A shared store would be needed if the API scales horizontally.
"""
from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request, status

MAX_FAILED_ATTEMPTS = 8
WINDOW_SECONDS = 15 * 60
_PRUNE_SECONDS = 60
_TOO_MANY_ATTEMPTS = "Too many attempts, try again later"

_attempts: dict[tuple[str, str], list[float]] = defaultdict(list)
_lock = Lock()
_last_prune = 0.0


def _key(realm: str, identifier: str) -> tuple[str, str]:
    return realm, identifier.strip().lower()


def _prune(now: float) -> None:
    global _last_prune
    if now - _last_prune < _PRUNE_SECONDS:
        return
    cutoff = now - WINDOW_SECONDS
    for key, attempts in list(_attempts.items()):
        recent = [ts for ts in attempts if ts > cutoff]
        if recent:
            _attempts[key] = recent
        else:
            _attempts.pop(key, None)
    _last_prune = now


def is_locked(realm: str, identifier: str | None) -> bool:
    if not identifier:
        return False
    now = time.monotonic()
    cutoff = now - WINDOW_SECONDS
    with _lock:
        _prune(now)
        attempts = _attempts.get(_key(realm, identifier), [])
        return len([ts for ts in attempts if ts > cutoff]) >= MAX_FAILED_ATTEMPTS


def require_allowed(realm: str, identifiers: list[str | None]) -> None:
    if any(is_locked(realm, identifier) for identifier in identifiers):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, _TOO_MANY_ATTEMPTS)


def record_failure(realm: str, identifiers: list[str | None]) -> None:
    now = time.monotonic()
    cutoff = now - WINDOW_SECONDS
    with _lock:
        _prune(now)
        for identifier in identifiers:
            if not identifier:
                continue
            key = _key(realm, identifier)
            _attempts[key] = [ts for ts in _attempts[key] if ts > cutoff]
            _attempts[key].append(now)


def reset(realm: str, identifiers: list[str | None]) -> None:
    with _lock:
        for identifier in identifiers:
            if identifier:
                _attempts.pop(_key(realm, identifier), None)


def client_ip(request: Request) -> str | None:
    return request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
        request.client.host if request.client else None
    )
