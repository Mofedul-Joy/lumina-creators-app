"""Local-dev upload target. Stands in for R2 presigned PUTs when R2 is not
configured: presign_put() points here and the body lands on local disk.

Security model mirrors a presigned URL: the object key embeds a uuid4 hex, so
the URL is unguessable; the route 404s entirely when R2 IS configured.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse, Response

from app.core.config import get_settings
from app.integrations import storage

router = APIRouter()


def _guard_local_mode() -> None:
    if not storage.is_local_mode():
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
