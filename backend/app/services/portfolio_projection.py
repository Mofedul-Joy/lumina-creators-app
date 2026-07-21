"""Shared portfolio response projection helpers."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations import storage
from app.models import PortfolioItem, StorageObject


def portfolio_item_outputs(db: Session, items: list[PortfolioItem]) -> list[dict]:
    object_ids = {p.storage_object_id for p in items if p.storage_object_id is not None}
    objects_by_id = {}
    if object_ids:
        objects_by_id = {
            obj.id: obj
            for obj in db.scalars(select(StorageObject).where(StorageObject.id.in_(object_ids))).all()
        }

    out = []
    for p in items:
        is_upload = p.storage_object_id is not None
        video_url = p.video_url
        if is_upload:
            obj = objects_by_id.get(p.storage_object_id)
            video_url = storage.object_public_url(obj.object_key) if obj else None
        out.append({
            "id": str(p.id),
            "brand_name": p.brand_name,
            "caption": p.caption,
            "platform": p.platform,
            "video_url": video_url,
            "thumbnail_url": p.thumbnail_url,
            "is_upload": is_upload,
            "is_top_content": p.is_top_content,
            "views": p.views,
            "likes": p.likes,
        })
    return out
