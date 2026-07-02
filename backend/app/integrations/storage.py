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
    params = {"Bucket": settings.r2_bucket, "Key": object_key}
    if content_type:
        params["ContentType"] = content_type
    return _client().generate_presigned_url("put_object", Params=params, ExpiresIn=settings.upload_url_ttl_sec)


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
