"""Messaging service: get-or-create the 1:1 thread, list threads, send, read state."""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import _now
from app.models import Admin, Conversation, Creator, CreatorProfile, Message
from app.models.campaign import Campaign
from app.models.contract import CreatorContract


def get_or_create_for_creator(db: Session, creator_id: uuid.UUID) -> Conversation:
    conv = db.scalar(select(Conversation).where(Conversation.creator_id == creator_id))
    if conv is not None:
        return conv
    conv = Conversation(creator_id=creator_id)
    db.add(conv)
    try:
        db.commit()
    except IntegrityError:  # concurrent create won the unique(creator_id) race
        db.rollback()
        conv = db.scalar(select(Conversation).where(Conversation.creator_id == creator_id))
    db.refresh(conv)
    return conv


def _get(db: Session, conversation_id: uuid.UUID) -> Conversation:
    conv = db.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return conv


def _unread(conv: Conversation, side: str, last_message_at) -> bool:
    """True if the newest message is unread for `side` ('admin' | 'creator')."""
    if last_message_at is None:
        return False
    watermark = conv.admin_last_read_at if side == "admin" else conv.creator_last_read_at
    return watermark is None or watermark < last_message_at


def list_for_admin(db: Session, *, unread_only: bool = False, archived: bool = False) -> list[dict]:
    """Every conversation that has at least one message, newest activity first,
    with the creator's identity + this side's unread/mute flags. Archived threads
    are hidden from the default inbox and only shown when `archived=True`."""
    rows = db.execute(
        select(Conversation, Creator, CreatorProfile.display_name, CreatorProfile.avatar_object_id)
        .join(Creator, Creator.id == Conversation.creator_id)
        .outerjoin(CreatorProfile, CreatorProfile.creator_id == Conversation.creator_id)
        .where(Conversation.last_message_at.isnot(None))
        .where(Conversation.admin_archived.is_(archived))
        .order_by(Conversation.last_message_at.desc())
    ).all()
    out = []
    for conv, creator, display_name, _avatar in rows:
        last = db.scalar(
            select(Message).where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc()).limit(1)
        )
        unread = _unread(conv, "admin", conv.last_message_at)
        if unread_only and not unread:
            continue
        out.append({
            "id": str(conv.id),
            "creator_id": str(creator.id),
            "name": display_name or creator.email.split("@")[0],
            "email": creator.email,
            "last_message": last.body if last else None,
            "last_message_at": conv.last_message_at,
            "last_sender": last.sender_type if last else None,
            "unread": unread,
            "muted": conv.admin_muted,
            "archived": conv.admin_archived,
        })
    return out


def admin_unread_count(db: Session) -> int:
    """Unread conversations for the badge — muted and archived threads don't count."""
    convs = db.scalars(
        select(Conversation)
        .where(Conversation.last_message_at.isnot(None))
        .where(Conversation.admin_muted.is_(False))
        .where(Conversation.admin_archived.is_(False))
    ).all()
    return sum(1 for c in convs if _unread(c, "admin", c.last_message_at))


def set_muted(db: Session, conversation_id: uuid.UUID, side: str, muted: bool) -> None:
    conv = _get(db, conversation_id)
    if side == "admin":
        conv.admin_muted = muted
    else:
        conv.creator_muted = muted
    db.commit()


def set_archived(db: Session, conversation_id: uuid.UUID, archived: bool) -> None:
    """Admin-side 'leave conversation' (archive) / restore."""
    conv = _get(db, conversation_id)
    conv.admin_archived = archived
    db.commit()


def conversation_info(db: Session, conversation_id: uuid.UUID) -> dict:
    """Lightweight metadata for the three-dots 'message history' view."""
    conv = _get(db, conversation_id)
    total = db.scalar(select(func.count(Message.id)).where(Message.conversation_id == conversation_id)) or 0
    first = db.scalar(
        select(Message.created_at).where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc()).limit(1)
    )
    return {
        "message_count": int(total),
        "first_message_at": first,
        "last_message_at": conv.last_message_at,
        "created_at": conv.created_at,
    }


def contract_history(db: Session, creator_id: uuid.UUID) -> list[dict]:
    """Every campaign agreement this creator has, newest first — powers the
    three-dots 'contract history' view on both sides."""
    rows = db.execute(
        select(CreatorContract, Campaign.name)
        .join(Campaign, Campaign.id == CreatorContract.campaign_id)
        .where(CreatorContract.creator_id == creator_id)
        .order_by(CreatorContract.created_at.desc())
    ).all()
    return [
        {
            "document_id": c.document_id,
            "title": c.title,
            "campaign_name": campaign_title,
            "status": c.status,
            "sent_at": c.sent_at,
            "accepted_at": c.accepted_at,
            "created_at": c.created_at,
        }
        for c, campaign_title in rows
    ]


def creator_thread_dict(db: Session, conv: Conversation, creator: Creator) -> dict:
    """The creator's single thread with the company (counterparty = the team)."""
    last = db.scalar(
        select(Message).where(Message.conversation_id == conv.id)
        .order_by(Message.created_at.desc()).limit(1)
    )
    admin_email = db.scalar(select(Admin.email).order_by(Admin.created_at.asc()).limit(1))
    return {
        "id": str(conv.id),
        "creator_id": str(creator.id),
        "name": "Lumina Team",
        "email": admin_email,
        "last_message": last.body if last else None,
        "last_message_at": conv.last_message_at,
        "last_sender": last.sender_type if last else None,
        "unread": _unread(conv, "creator", conv.last_message_at),
        "muted": conv.creator_muted,
        "archived": False,
    }


def creator_unread_count(db: Session, creator_id: uuid.UUID) -> int:
    conv = db.scalar(select(Conversation).where(Conversation.creator_id == creator_id))
    if conv is None or conv.creator_muted:
        return 0
    return 1 if _unread(conv, "creator", conv.last_message_at) else 0


def list_messages(db: Session, conversation_id: uuid.UUID) -> list[Message]:
    _get(db, conversation_id)
    return db.scalars(
        select(Message).where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    ).all()


def send_message(db: Session, conversation_id: uuid.UUID, sender_type: str,
                 body: str, sender_admin_id: uuid.UUID | None = None) -> Message:
    body = (body or "").strip()
    if not body:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Message can't be empty")
    conv = _get(db, conversation_id)
    now = _now()
    msg = Message(
        conversation_id=conv.id, sender_type=sender_type, body=body,
        sender_admin_id=sender_admin_id, created_at=now,
    )
    db.add(msg)
    conv.last_message_at = now
    # The sender has, by definition, read up to their own message.
    if sender_type == "admin":
        conv.admin_last_read_at = now
    else:
        conv.creator_last_read_at = now
        # A new creator message pulls the thread back into the admin inbox.
        conv.admin_archived = False
    db.commit()
    db.refresh(msg)
    return msg


def mark_read(db: Session, conversation_id: uuid.UUID, side: str) -> None:
    conv = _get(db, conversation_id)
    if side == "admin":
        conv.admin_last_read_at = _now()
    else:
        conv.creator_last_read_at = _now()
    db.commit()
