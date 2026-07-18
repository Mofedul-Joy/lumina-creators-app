"""Public upload targets that stand in for direct-to-R2 presigned PUTs.

Two modes, both make the browser talk only to THIS API (never to storage):
  * local mode  (dev, no R2)      -> PUT/GET /uploads/local/{key}  (disk)
  * proxy mode  (R2 + UPLOAD_PROXY) -> PUT/GET /uploads/r2/{key}   (streamed to R2)

Proxy mode avoids needing an R2 bucket CORS policy. Security mirrors a presigned
URL: the object key embeds a uuid4 hex, so the URL is unguessable; each route
404s when its mode is inactive.
"""
from __future__ import annotations

import hmac
import tempfile
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse, Response, StreamingResponse

from app.core.config import get_settings
from app.integrations import storage
from app.services.uploads import upload_signature

router = APIRouter()

# Safe media content-types only. The point is to never reflect back a
# script-executable type (text/html, image/svg+xml, application/javascript, xml)
# that a stored-content-injection could weaponize — but still serve real
# creator media (avatars = images, uploaded portfolio/proof clips = video) with
# the correct type so it renders/plays inline. Anything else → octet-stream.
_SAFE_MEDIA_TYPES = {
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".m4v": "video/x-m4v",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
}


def _guard_local_mode() -> None:
    if not storage.is_local_mode():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")


def _guard_proxy_mode() -> None:
    if not storage.is_proxy_mode():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")


# Content-types that a stored-content-injection could weaponize if reflected.
_DANGEROUS_TYPES = {
    "text/html", "application/xhtml+xml", "image/svg+xml",
    "application/javascript", "text/javascript",
    "application/xml", "text/xml",
}


def _safe_content_type(object_key: str) -> str:
    """Type to STORE on write — strict media whitelist, else octet-stream."""
    return _SAFE_MEDIA_TYPES.get(Path(object_key).suffix.lower(), "application/octet-stream")


def _serve_content_type(object_key: str, stored: str | None = None) -> str:
    """Type to SERVE on read — prefer the extension's media type; else keep the
    object's stored type UNLESS it's a scriptable/HTML type (then octet-stream).
    Keeps legacy extension-less images/videos rendering while never reflecting a
    weaponizable content-type."""
    ext_type = _SAFE_MEDIA_TYPES.get(Path(object_key).suffix.lower())
    if ext_type:
        return ext_type
    if stored and stored.lower() not in _DANGEROUS_TYPES:
        return stored
    return "application/octet-stream"


def _verify_upload_signature(object_key: str, request: Request) -> None:
    sig = request.query_params.get("sig")
    exp = request.query_params.get("exp")
    if not sig or not exp:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid upload signature")
    try:
        expires_at = int(exp)
    except ValueError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid upload signature")
    if expires_at <= int(time.time()):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Upload URL expired")
    expected = upload_signature(object_key, exp)
    if not hmac.compare_digest(sig, expected):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid upload signature")


@router.put("/uploads/local/{object_key:path}")
async def put_local(object_key: str, request: Request) -> Response:
    _guard_local_mode()
    _verify_upload_signature(object_key, request)
    try:
        path = storage.local_path(object_key)
    except RuntimeError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid object key")
    body = await request.body()
    if len(body) > get_settings().max_upload_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File exceeds the size limit")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    return Response(status_code=200)


@router.get("/uploads/local/{object_key:path}")
def get_local(object_key: str) -> FileResponse:
    _guard_local_mode()
    try:
        path = storage.local_path(object_key)
    except RuntimeError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid object key")
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return FileResponse(
        path,
        media_type=_serve_content_type(object_key),
        headers={"X-Content-Type-Options": "nosniff"},
    )


@router.put("/uploads/r2/{object_key:path}")
async def put_r2(object_key: str, request: Request) -> Response:
    _guard_proxy_mode()
    _verify_upload_signature(object_key, request)
    max_bytes = get_settings().max_upload_bytes
    # Spool to disk past 8 MB so a large upload never sits fully in RAM.
    with tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024) as spool:
        total = 0
        async for chunk in request.stream():
            total += len(chunk)
            if total > max_bytes:
                raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File exceeds the size limit")
            spool.write(chunk)
        spool.seek(0)
        try:
            storage.put_r2_fileobj(object_key, spool, _safe_content_type(object_key))
        except Exception:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Upload to storage failed")
    return Response(status_code=200)


@router.get("/uploads/r2/{object_key:path}")
def get_r2(object_key: str) -> StreamingResponse:
    _guard_proxy_mode()
    result = storage.get_r2_object(object_key)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    body, stored_content_type, content_length = result
    headers = {"X-Content-Type-Options": "nosniff"}
    if content_length is not None:
        headers["Content-Length"] = str(content_length)
    return StreamingResponse(
        body.iter_chunks(),
        media_type=_serve_content_type(object_key, stored_content_type),
        headers=headers,
    )
