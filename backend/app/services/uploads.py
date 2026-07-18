"""Upload lifecycle: presign -> (client PUTs to R2) -> finalize. Only finalized
objects may be attached to a profile/portfolio/submission."""
from __future__ import annotations

import hashlib
import hmac
import time
import uuid
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import _now
from app.integrations import storage
from app.models import StorageObject

_PURPOSES = {"avatar", "portfolio_video", "proof_video"}
_UPLOAD_URL_TTL_SEC = 15 * 60


def upload_signature(object_key: str, expires_at: str) -> str:
    settings = get_settings()
    msg = f"{object_key}:{expires_at}".encode()
    return hmac.new(settings.jwt_secret.encode(), msg, hashlib.sha256).hexdigest()


def _signed_upload_url(url: str, object_key: str) -> str:
    if not (storage.is_local_mode() or storage.is_proxy_mode()):
        return url
    expires_at = str(int(time.time()) + _UPLOAD_URL_TTL_SEC)
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["sig"] = upload_signature(object_key, expires_at)
    query["exp"] = expires_at
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def create_presigned_upload(db: Session, creator_id, purpose: str, content_type, filename, size_bytes):
    if purpose not in _PURPOSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid upload purpose")
    settings = get_settings()
    if size_bytes and size_bytes > settings.max_upload_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File exceeds the size limit")
    key = storage.make_object_key(purpose, creator_id, filename or "")
    try:
        url = storage.presign_put(key, content_type)
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))
    url = _signed_upload_url(url, key)
    obj = StorageObject(
        owner_creator_id=creator_id, purpose=purpose, bucket=settings.r2_bucket,
        object_key=key, content_type=content_type, size_bytes=size_bytes, status="pending",
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj, url, key


def create_admin_image_upload(db: Session, content_type, filename, size_bytes):
    """Admin banner/thumbnail upload — not creator-owned (owner_creator_id NULL).
    ponytail: reuse the 'avatar' purpose (a public image) to avoid a new enum + migration."""
    settings = get_settings()
    if size_bytes and size_bytes > settings.max_upload_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File exceeds the size limit")
    key = storage.make_object_key("avatar", uuid.uuid4(), filename or "")
    try:
        url = storage.presign_put(key, content_type)
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))
    url = _signed_upload_url(url, key)
    obj = StorageObject(
        owner_creator_id=None, purpose="avatar", bucket=settings.r2_bucket,
        object_key=key, content_type=content_type, size_bytes=size_bytes, status="pending",
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj, url, key


def finalize_admin_image(db: Session, object_id: uuid.UUID) -> StorageObject:
    obj = db.get(StorageObject, object_id)
    if obj is None or obj.owner_creator_id is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upload not found")
    if obj.status == "finalized":
        return obj
    if storage.head_object(obj.object_key) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded file not found in storage")
    obj.status = "finalized"
    obj.finalized_at = _now()
    db.commit()
    db.refresh(obj)
    return obj


def finalize_upload(db: Session, creator_id, object_id: uuid.UUID) -> StorageObject:
    obj = db.get(StorageObject, object_id)
    if obj is None or obj.owner_creator_id != creator_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Upload not found")
    if obj.status == "finalized":
        return obj
    # ponytail: confirm the object actually landed; content-type/virus scanning is later hardening
    if storage.head_object(obj.object_key) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded file not found in storage")
    obj.status = "finalized"
    obj.finalized_at = _now()
    db.commit()
    db.refresh(obj)
    return obj
