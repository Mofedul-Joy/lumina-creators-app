"""Creator uploads: presign (start) + finalize (confirm). Self-scoped."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_creator
from app.db.session import get_db
from app.models import Creator
from app.schemas.uploads import PresignIn, PresignOut, StorageObjectOut
from app.services import uploads as svc

router = APIRouter(prefix="/uploads", tags=["creator-uploads"])


@router.post("/presign", response_model=PresignOut)
def presign(body: PresignIn, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    obj, url, key = svc.create_presigned_upload(
        db, current.id, body.purpose, body.content_type, body.filename, body.size_bytes
    )
    return PresignOut(object_id=str(obj.id), object_key=key, upload_url=url)


@router.post("/{object_id}/finalize", response_model=StorageObjectOut)
def finalize(object_id: uuid.UUID, current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    obj = svc.finalize_upload(db, current.id, object_id)
    return StorageObjectOut(id=str(obj.id), purpose=obj.purpose, status=obj.status, content_type=obj.content_type)
