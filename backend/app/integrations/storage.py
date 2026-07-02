"""Cloudflare R2 (S3-compatible) presigned uploads. boto3 is imported lazily so the
app boots without it/creds installed locally (only presign calls need them).

When R2 is NOT configured, uploads fall back to local disk: presigned URLs point
back at this API (PUT /uploads/local/{key}) and files land in local_storage_dir.
"""
from __future__ import annotations

import uuid
from pathlib import Path
from urllib.parse import quote

from app.core.config import get_settings


def is_local_mode() -> bool:
    """Local-disk fallback is DEV-ONLY. In production, missing R2 config is a
    hard startup failure (see Settings.validate_for_runtime), never a silent
    fallback to ephemeral disk."""
    s = get_settings()
    return not s.r2_configured and not s.is_production


def is_proxy_mode() -> bool:
    """Uploads stream through this API to R2 (browser never PUTs to R2 directly)."""
    s = get_settings()
    return s.r2_configured and s.upload_proxy


def local_path(object_key: str) -> Path:
    root = Path(get_settings().local_storage_dir).resolve()
    p = (root / object_key).resolve()
    if not p.is_relative_to(root):  # path traversal guard
        raise RuntimeError("Invalid object key")
    return p


def _client():
    settings = get_settings()
    if not (settings.r2_endpoint and settings.r2_access_key_id and settings.r2_secret_access_key):
        raise RuntimeError("R2 storage is not configured (set R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)")
    import boto3  # lazy: keeps the app importable without boto3 installed

    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
    )


def make_object_key(purpose: str, creator_id, filename_hint: str = "") -> str:
    ext = ("." + filename_hint.rsplit(".", 1)[-1]) if "." in filename_hint else ""
    return f"{purpose}/{creator_id}/{uuid.uuid4().hex}{ext}"


def presign_put(object_key: str, content_type: str | None) -> str:
    settings = get_settings()
    if is_local_mode():
        return f"{settings.api_public_url}/uploads/local/{quote(object_key)}"
    if is_proxy_mode():
        return f"{settings.api_public_url}/uploads/r2/{quote(object_key)}"
    params = {"Bucket": settings.r2_bucket, "Key": object_key}
    if content_type:
        params["ContentType"] = content_type
    return _client().generate_presigned_url("put_object", Params=params, ExpiresIn=settings.upload_url_ttl_sec)


def put_r2_fileobj(object_key: str, fileobj, content_type: str | None) -> None:
    """Stream a file-like object into R2 (used by the upload proxy). boto3
    upload_fileobj streams in parts, so large files never fully hit memory."""
    settings = get_settings()
    extra = {"ContentType": content_type} if content_type else None
    _client().upload_fileobj(fileobj, settings.r2_bucket, object_key, ExtraArgs=extra)


def get_r2_object(object_key: str):
    """Return (streaming_body, content_type, content_length) or None if missing."""
    settings = get_settings()
    try:
        obj = _client().get_object(Bucket=settings.r2_bucket, Key=object_key)
    except Exception:
        return None
    return obj["Body"], obj.get("ContentType"), obj.get("ContentLength")


def head_object(object_key: str) -> dict | None:
    """Confirm the object exists after upload (for finalize). None if missing."""
    settings = get_settings()
    if is_local_mode():
        try:
            p = local_path(object_key)
        except RuntimeError:
            return None
        return {"ContentLength": p.stat().st_size} if p.is_file() else None
    try:
        return _client().head_object(Bucket=settings.r2_bucket, Key=object_key)
    except Exception:
        return None
