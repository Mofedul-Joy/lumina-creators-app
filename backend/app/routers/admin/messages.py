"""Admin messaging: DM threads with creators. Admin-only."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models import Admin, Message
from app.schemas.messaging import (
    ConversationOut, MessageIn, MessageOut, StartConversationIn, UnreadCountOut,
)
from app.services import messaging as svc

router = APIRouter(prefix="/conversations", tags=["admin-messages"])


def _msg_out(m: Message) -> MessageOut:
    return MessageOut(
        id=str(m.id), conversation_id=str(m.conversation_id), sender_type=m.sender_type,
        sender_admin_id=str(m.sender_admin_id) if m.sender_admin_id else None,
        body=m.body, created_at=m.created_at,
    )


@router.get("", response_model=list[ConversationOut])
def list_conversations(unread: bool = False, admin: Admin = Depends(get_current_admin),
                       db: Session = Depends(get_db)):
    return [ConversationOut(**c) for c in svc.list_for_admin(db, unread_only=unread)]


@router.get("/unread-count", response_model=UnreadCountOut)
def unread_count(admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return UnreadCountOut(unread=svc.admin_unread_count(db))


@router.post("/start", response_model=ConversationOut)
def start(body: StartConversationIn, admin: Admin = Depends(get_current_admin),
          db: Session = Depends(get_db)):
    """Open (or reuse) the DM thread with a creator — used by the 'message this
    creator' buttons across the admin console."""
    from fastapi import HTTPException, status
    from sqlalchemy import select
    from app.models import Creator, CreatorProfile
    creator = db.get(Creator, uuid.UUID(body.creator_id))
    if creator is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Creator not found")
    conv = svc.get_or_create_for_creator(db, creator.id)
    display_name = db.scalar(select(CreatorProfile.display_name).where(CreatorProfile.creator_id == creator.id))
    return ConversationOut(
        id=str(conv.id), creator_id=str(creator.id),
        name=display_name or creator.email.split("@")[0], email=creator.email,
        last_message=None, last_message_at=conv.last_message_at, last_sender=None,
        unread=False,
    )


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
def messages(conversation_id: uuid.UUID, admin: Admin = Depends(get_current_admin),
             db: Session = Depends(get_db)):
    svc.mark_read(db, conversation_id, "admin")
    return [_msg_out(m) for m in svc.list_messages(db, conversation_id)]


@router.post("/{conversation_id}/messages", response_model=MessageOut)
def send(conversation_id: uuid.UUID, body: MessageIn, admin: Admin = Depends(get_current_admin),
         db: Session = Depends(get_db)):
    return _msg_out(svc.send_message(db, conversation_id, "admin", body.body, sender_admin_id=admin.id))


@router.post("/{conversation_id}/read", status_code=204)
def read(conversation_id: uuid.UUID, admin: Admin = Depends(get_current_admin),
         db: Session = Depends(get_db)):
    svc.mark_read(db, conversation_id, "admin")
