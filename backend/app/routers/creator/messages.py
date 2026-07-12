"""Creator messaging: the DM thread with the Lumina team. Creator-only."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_creator
from app.db.session import get_db
from app.models import Conversation, Creator, Message
from app.schemas.messaging import ConversationOut, MessageIn, MessageOut, UnreadCountOut
from app.services import messaging as svc

router = APIRouter(prefix="/conversations", tags=["creator-messages"])


def _msg_out(m: Message) -> MessageOut:
    return MessageOut(
        id=str(m.id), conversation_id=str(m.conversation_id), sender_type=m.sender_type,
        sender_admin_id=str(m.sender_admin_id) if m.sender_admin_id else None,
        body=m.body, created_at=m.created_at,
    )


def _owned(db: Session, conversation_id: uuid.UUID, creator_id: uuid.UUID) -> Conversation:
    conv = db.get(Conversation, conversation_id)
    if conv is None or conv.creator_id != creator_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return conv


@router.get("", response_model=list[ConversationOut])
def my_conversations(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    """The creator has a single thread with the team. Auto-created so the UI
    always has somewhere to type, even before the team writes first."""
    conv = svc.get_or_create_for_creator(db, current.id)
    return [ConversationOut(**svc.creator_thread_dict(db, conv, current))]


@router.get("/unread-count", response_model=UnreadCountOut)
def unread_count(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    return UnreadCountOut(unread=svc.creator_unread_count(db, current.id))


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
def messages(conversation_id: uuid.UUID, current: Creator = Depends(get_current_creator),
             db: Session = Depends(get_db)):
    _owned(db, conversation_id, current.id)
    svc.mark_read(db, conversation_id, "creator")
    return [_msg_out(m) for m in svc.list_messages(db, conversation_id)]


@router.post("/{conversation_id}/messages", response_model=MessageOut)
def send(conversation_id: uuid.UUID, body: MessageIn, current: Creator = Depends(get_current_creator),
         db: Session = Depends(get_db)):
    _owned(db, conversation_id, current.id)
    return _msg_out(svc.send_message(db, conversation_id, "creator", body.body))


@router.post("/{conversation_id}/read", status_code=204)
def read(conversation_id: uuid.UUID, current: Creator = Depends(get_current_creator),
         db: Session = Depends(get_db)):
    _owned(db, conversation_id, current.id)
    svc.mark_read(db, conversation_id, "creator")
