"""Creator messaging: the DM thread with the Lumina team. Creator-only."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_creator
from app.db.session import get_db
from app.models import Conversation, Creator, Message
from app.schemas.messaging import (
    ContractHistoryItem, ConversationInfoOut, ConversationOut, MessageIn,
    MessageOut, MutedIn, UnreadCountOut,
)
from app.services import messaging as svc

router = APIRouter(prefix="/conversations", tags=["creator-messages"])


def _owned(db: Session, conversation_id: uuid.UUID, creator_id: uuid.UUID) -> Conversation:
    """A creator may access their own DM or any channel they're a member of."""
    conv = db.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    if conv.kind == "channel":
        if not svc.creator_in_channel(db, conversation_id, creator_id):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    elif conv.creator_id != creator_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return conv


@router.get("", response_model=list[ConversationOut])
def my_conversations(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    """The creator's DM with the team (auto-created so there's always somewhere
    to type) plus every channel they belong to."""
    return [ConversationOut(**c) for c in svc.list_for_creator(db, current.id)]


@router.get("/unread-count", response_model=UnreadCountOut)
def unread_count(current: Creator = Depends(get_current_creator), db: Session = Depends(get_db)):
    return UnreadCountOut(unread=svc.creator_unread_count(db, current.id))


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
def messages(conversation_id: uuid.UUID, current: Creator = Depends(get_current_creator),
             db: Session = Depends(get_db)):
    _owned(db, conversation_id, current.id)
    svc.mark_read(db, conversation_id, "creator", creator_id=current.id)
    return [MessageOut(**d) for d in svc.list_messages_dicts(db, conversation_id)]


@router.post("/{conversation_id}/messages", response_model=MessageOut)
def send(conversation_id: uuid.UUID, body: MessageIn, current: Creator = Depends(get_current_creator),
         db: Session = Depends(get_db)):
    _owned(db, conversation_id, current.id)
    m = svc.send_message(db, conversation_id, "creator", body.body, sender_creator_id=current.id)
    return MessageOut(
        id=str(m.id), conversation_id=str(m.conversation_id), sender_type=m.sender_type,
        sender_admin_id=None, sender_creator_id=str(current.id), body=m.body, created_at=m.created_at,
    )


@router.post("/{conversation_id}/read", status_code=204)
def read(conversation_id: uuid.UUID, current: Creator = Depends(get_current_creator),
         db: Session = Depends(get_db)):
    _owned(db, conversation_id, current.id)
    svc.mark_read(db, conversation_id, "creator", creator_id=current.id)


# ── three-dots menu ──
@router.post("/{conversation_id}/mute", status_code=204)
def mute(conversation_id: uuid.UUID, body: MutedIn, current: Creator = Depends(get_current_creator),
         db: Session = Depends(get_db)):
    conv = _owned(db, conversation_id, current.id)
    if conv.kind == "channel":
        svc.set_channel_muted(db, conversation_id, current.id, body.muted)
    else:
        svc.set_muted(db, conversation_id, "creator", body.muted)


@router.get("/{conversation_id}/info", response_model=ConversationInfoOut)
def info(conversation_id: uuid.UUID, current: Creator = Depends(get_current_creator),
         db: Session = Depends(get_db)):
    _owned(db, conversation_id, current.id)
    return ConversationInfoOut(**svc.conversation_info(db, conversation_id))


@router.get("/{conversation_id}/contracts", response_model=list[ContractHistoryItem])
def contracts(conversation_id: uuid.UUID, current: Creator = Depends(get_current_creator),
              db: Session = Depends(get_db)):
    _owned(db, conversation_id, current.id)
    return [ContractHistoryItem(**c) for c in svc.contract_history(db, current.id)]
