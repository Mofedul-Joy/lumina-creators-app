"""Admin image uploads (campaign banners/thumbnails). presign -> PUT -> finalize,
returns a public URL to store as the campaign's banner. Admin-only."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.integrations import storage
from app.models import Admin
from app.services import uploads as svc

router = APIRouter(prefix="/uploads", tags=["admin-uploads"])


class ImagePresignIn(BaseModel):
    content_type: Optional[str] = None
    filename: Optional[str] = None
    size_bytes: Optional[int] = None


class ImagePresignOut(BaseModel):
    object_id: str
    object_key: str
    upload_url: str
    public_url: str


class ImageUploadOut(BaseModel):
    id: str
    public_url: str


@router.post("/presign", response_model=ImagePresignOut)
def presign(body: ImagePresignIn, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    obj, url, key = svc.create_admin_image_upload(db, body.content_type, body.filename, body.size_bytes)
    return ImagePresignOut(object_id=str(obj.id), object_key=key, upload_url=url,
                           public_url=storage.object_public_url(key))


@router.post("/{object_id}/finalize", response_model=ImageUploadOut)
def finalize(object_id: uuid.UUID, admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    obj = svc.finalize_admin_image(db, object_id)
    return ImageUploadOut(id=str(obj.id), public_url=storage.object_public_url(obj.object_key))
