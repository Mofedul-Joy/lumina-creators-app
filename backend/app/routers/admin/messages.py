"""Admin messaging: DM threads with creators. Admin-only."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.models import Admin, Conversation, Message
from app.schemas.messaging import (
    ArchivedIn, ChannelMemberOut, ChannelMembersIn, ContractHistoryItem,
    ConversationInfoOut, ConversationOut, CreateChannelIn, MessageIn, MessageOut,
    MutedIn, StartConversationIn, UnreadCountOut,
)
from app.services import messaging as svc

router = APIRouter(prefix="/conversations", tags=["admin-messages"])


def _msg_out(m: Message) -> MessageOut:
    return MessageOut(
        id=str(m.id), conversation_id=str(m.conversation_id), sender_type=m.sender_type,
        sender_admin_id=str(m.sender_admin_id) if m.sender_admin_id else None,
        sender_creator_id=str(m.sender_creator_id) if m.sender_creator_id else None,
        body=m.body, created_at=m.created_at,
    )


def _creator_id(db: Session, conversation_id: uuid.UUID) -> Optional[uuid.UUID]:
    from fastapi import HTTPException, status
    conv = db.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return conv.creator_id


@router.get("", response_model=list[ConversationOut])
def list_conversations(unread: bool = False, archived: bool = False, kind: Optional[str] = None,
                       admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    return [ConversationOut(**c) for c in svc.list_for_admin(db, unread_only=unread, archived=archived, kind=kind)]


# ── channels (group threads) ──
@router.post("/channels", response_model=ConversationOut)
def create_channel(body: CreateChannelIn, admin: Admin = Depends(get_current_admin),
                   db: Session = Depends(get_db)):
    conv = svc.create_channel(db, body.title, [uuid.UUID(c) for c in body.creator_ids])
    # Seed the thread so it appears in members' lists right away.
    svc.send_message(db, conv.id, "admin", f"Welcome to #{conv.title} 👋", sender_admin_id=admin.id)
    return ConversationOut(**svc._admin_row(db, conv))


@router.get("/{conversation_id}/members", response_model=list[ChannelMemberOut])
def channel_members(conversation_id: uuid.UUID, admin: Admin = Depends(get_current_admin),
                    db: Session = Depends(get_db)):
    return [ChannelMemberOut(**m) for m in svc.list_channel_members(db, conversation_id)]


@router.post("/{conversation_id}/members", status_code=204)
def add_members(conversation_id: uuid.UUID, body: ChannelMembersIn,
                admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    svc.add_channel_members(db, conversation_id, [uuid.UUID(c) for c in body.creator_ids])


@router.delete("/{conversation_id}/members/{creator_id}", status_code=204)
def remove_member(conversation_id: uuid.UUID, creator_id: uuid.UUID,
                  admin: Admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    svc.remove_channel_member(db, conversation_id, creator_id)


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
    return [MessageOut(**d) for d in svc.list_messages_dicts(db, conversation_id)]


@router.post("/{conversation_id}/messages", response_model=MessageOut)
def send(conversation_id: uuid.UUID, body: MessageIn, admin: Admin = Depends(get_current_admin),
         db: Session = Depends(get_db)):
    return _msg_out(svc.send_message(db, conversation_id, "admin", body.body, sender_admin_id=admin.id))


@router.post("/{conversation_id}/read", status_code=204)
def read(conversation_id: uuid.UUID, admin: Admin = Depends(get_current_admin),
         db: Session = Depends(get_db)):
    svc.mark_read(db, conversation_id, "admin")


# ── three-dots menu ──
@router.post("/{conversation_id}/mute", status_code=204)
def mute(conversation_id: uuid.UUID, body: MutedIn, admin: Admin = Depends(get_current_admin),
         db: Session = Depends(get_db)):
    svc.set_muted(db, conversation_id, "admin", body.muted)


@router.post("/{conversation_id}/archive", status_code=204)
def archive(conversation_id: uuid.UUID, body: ArchivedIn, admin: Admin = Depends(get_current_admin),
            db: Session = Depends(get_db)):
    """'Leave conversation' — archive it out of the inbox (restorable)."""
    svc.set_archived(db, conversation_id, body.archived)


@router.get("/{conversation_id}/info", response_model=ConversationInfoOut)
def info(conversation_id: uuid.UUID, admin: Admin = Depends(get_current_admin),
         db: Session = Depends(get_db)):
    return ConversationInfoOut(**svc.conversation_info(db, conversation_id))


@router.get("/{conversation_id}/contracts", response_model=list[ContractHistoryItem])
def contracts(conversation_id: uuid.UUID, admin: Admin = Depends(get_current_admin),
              db: Session = Depends(get_db)):
    return [ContractHistoryItem(**c) for c in svc.contract_history(db, _creator_id(db, conversation_id))]
