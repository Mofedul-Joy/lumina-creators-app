"""Upload schemas. Optional[...] for 3.9 Pydantic."""
from typing import Optional

from pydantic import BaseModel


class PresignIn(BaseModel):
    purpose: str  # avatar | portfolio_video | proof_video
    content_type: Optional[str] = None
    filename: Optional[str] = None
    size_bytes: Optional[int] = None


class PresignOut(BaseModel):
    object_id: str
    object_key: str
    upload_url: str


class StorageObjectOut(BaseModel):
    id: str
    purpose: str
    status: str
    content_type: Optional[str] = None
    # A GET-able URL for the finalized object. For an image poster this lets the
    # client store a stable thumbnail URL to show instantly, instead of decoding
    # the video's first frame on every page load.
    public_url: Optional[str] = None
