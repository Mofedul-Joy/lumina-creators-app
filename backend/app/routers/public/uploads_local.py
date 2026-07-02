"""Public upload targets that stand in for direct-to-R2 presigned PUTs.

Two modes, both make the browser talk only to THIS API (never to storage):
  * local mode  (dev, no R2)      -> PUT/GET /uploads/local/{key}  (disk)
  * proxy mode  (R2 + UPLOAD_PROXY) -> PUT/GET /uploads/r2/{key}   (streamed to R2)

Proxy mode avoids needing an R2 bucket CORS policy. Security mirrors a presigned
URL: the object key embeds a uuid4 hex, so the URL is unguessable; each route
404s when its mode is inactive.
"""
from __future__ import annotations

import tempfile

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse, Response, StreamingResponse

from app.core.config import get_settings
from app.integrations import storage

router = APIRouter()


def _guard_local_mode() -> None:
    if not storage.is_local_mode():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")


def _guard_proxy_mode() -> None:
    if not storage.is_proxy_mode():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")


@router.put("/uploads/local/{object_key:path}")
async def put_local(object_key: str, request: Request) -> Response:
    _guard_local_mode()
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
    return FileResponse(path)


@router.put("/uploads/r2/{object_key:path}")
async def put_r2(object_key: str, request: Request) -> Response:
    _guard_proxy_mode()
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
            storage.put_r2_fileobj(object_key, spool, request.headers.get("content-type"))
        except Exception:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Upload to storage failed")
    return Response(status_code=200)


@router.get("/uploads/r2/{object_key:path}")
def get_r2(object_key: str) -> StreamingResponse:
    _guard_proxy_mode()
    result = storage.get_r2_object(object_key)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    body, content_type, content_length = result
    headers = {"Content-Length": str(content_length)} if content_length is not None else {}
    return StreamingResponse(body.iter_chunks(), media_type=content_type or "application/octet-stream", headers=headers)
