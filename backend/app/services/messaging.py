"""Messaging service: get-or-create the 1:1 thread, list threads, send, read state."""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import _now
from app.models import (
    Admin, Conversation, ConversationMember, Creator, CreatorProfile, Message,
)
from app.models.campaign import Campaign
from app.models.contract import CreatorContract


def get_or_create_for_creator(db: Session, creator_id: uuid.UUID) -> Conversation:
    conv = db.scalar(
        select(Conversation).where(Conversation.creator_id == creator_id, Conversation.kind == "dm")
    )
    if conv is not None:
        return conv
    conv = Conversation(creator_id=creator_id, kind="dm")
    db.add(conv)
    try:
        db.commit()
    except IntegrityError:  # concurrent create won the unique(creator_id) race
        db.rollback()
        conv = db.scalar(
            select(Conversation).where(Conversation.creator_id == creator_id, Conversation.kind == "dm")
        )
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


def _admin_row(db: Session, conv: Conversation) -> dict:
    """One admin-side inbox row for either a DM or a channel."""
    last = db.scalar(
        select(Message).where(Message.conversation_id == conv.id)
        .order_by(Message.created_at.desc()).limit(1)
    )
    row = {
        "id": str(conv.id),
        "kind": conv.kind,
        "creator_id": str(conv.creator_id) if conv.creator_id else None,
        "last_message": last.body if last else None,
        "last_message_at": conv.last_message_at,
        "last_sender": last.sender_type if last else None,
        "unread": _unread(conv, "admin", conv.last_message_at),
        "muted": conv.admin_muted,
        "archived": conv.admin_archived,
        "member_count": None,
    }
    if conv.kind == "channel":
        row["name"] = conv.title or "Untitled channel"
        row["email"] = None
        row["whatsapp"] = None
        row["member_count"] = db.scalar(
            select(func.count(ConversationMember.id)).where(ConversationMember.conversation_id == conv.id)
        ) or 0
    else:
        creator = db.get(Creator, conv.creator_id)
        prof = db.scalar(select(CreatorProfile).where(CreatorProfile.creator_id == conv.creator_id))
        display_name = prof.display_name if prof else None
        row["name"] = display_name or (creator.email.split("@")[0] if creator else "Creator")
        row["email"] = creator.email if creator else None
        row["whatsapp"] = prof.whatsapp if prof else None
    return row


def list_for_admin(db: Session, *, unread_only: bool = False, archived: bool = False,
                   kind: str | None = None) -> list[dict]:
    """Every conversation (DM or channel) that has at least one message, newest
    activity first. Archived threads are hidden unless `archived=True`; `kind`
    optionally filters to just 'dm' or 'channel'."""
    q = (
        select(Conversation)
        .where(Conversation.last_message_at.isnot(None))
        .where(Conversation.admin_archived.is_(archived))
        .order_by(Conversation.last_message_at.desc())
    )
    if kind:
        q = q.where(Conversation.kind == kind)
    out = []
    for conv in db.scalars(q).all():
        row = _admin_row(db, conv)
        if unread_only and not row["unread"]:
            continue
        out.append(row)
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
        "kind": "dm",
        "creator_id": str(creator.id),
        "name": "Lumina Team",
        "email": admin_email,
        "whatsapp": None,
        "last_message": last.body if last else None,
        "last_message_at": conv.last_message_at,
        "last_sender": last.sender_type if last else None,
        "unread": _unread(conv, "creator", conv.last_message_at),
        "muted": conv.creator_muted,
        "archived": False,
        "member_count": None,
    }


def _member(db: Session, conversation_id: uuid.UUID, creator_id: uuid.UUID) -> ConversationMember | None:
    return db.scalar(
        select(ConversationMember).where(
            ConversationMember.conversation_id == conversation_id,
            ConversationMember.creator_id == creator_id,
        )
    )


def _channel_unread(member: ConversationMember, last_message_at) -> bool:
    if last_message_at is None:
        return False
    return member.last_read_at is None or member.last_read_at < last_message_at


def _creator_channel_dict(db: Session, conv: Conversation, member: ConversationMember) -> dict:
    last = db.scalar(
        select(Message).where(Message.conversation_id == conv.id)
        .order_by(Message.created_at.desc()).limit(1)
    )
    count = db.scalar(
        select(func.count(ConversationMember.id)).where(ConversationMember.conversation_id == conv.id)
    ) or 0
    return {
        "id": str(conv.id),
        "kind": "channel",
        "creator_id": None,
        "name": conv.title or "Untitled channel",
        "email": None,
        "whatsapp": None,
        "last_message": last.body if last else None,
        "last_message_at": conv.last_message_at,
        "last_sender": last.sender_type if last else None,
        "unread": _channel_unread(member, conv.last_message_at),
        "muted": member.muted,
        "archived": False,
        "member_count": int(count),
    }


def list_for_creator(db: Session, creator_id: uuid.UUID) -> list[dict]:
    """The creator's DM with the team + every channel they belong to (that has
    at least one message), newest activity first."""
    dm = get_or_create_for_creator(db, creator_id)
    creator = db.get(Creator, creator_id)
    rows = [creator_thread_dict(db, dm, creator)]
    memberships = db.execute(
        select(Conversation, ConversationMember)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .where(ConversationMember.creator_id == creator_id)
        .where(Conversation.last_message_at.isnot(None))
    ).all()
    rows += [_creator_channel_dict(db, conv, member) for conv, member in memberships]
    rows.sort(key=lambda r: (r["last_message_at"] is not None, r["last_message_at"]), reverse=True)
    return rows


def creator_unread_count(db: Session, creator_id: uuid.UUID) -> int:
    total = 0
    dm = db.scalar(
        select(Conversation).where(Conversation.creator_id == creator_id, Conversation.kind == "dm")
    )
    if dm is not None and not dm.creator_muted and _unread(dm, "creator", dm.last_message_at):
        total += 1
    memberships = db.execute(
        select(Conversation, ConversationMember)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .where(ConversationMember.creator_id == creator_id)
    ).all()
    for conv, member in memberships:
        if not member.muted and _channel_unread(member, conv.last_message_at):
            total += 1
    return total


def list_messages(db: Session, conversation_id: uuid.UUID) -> list[Message]:
    _get(db, conversation_id)
    return db.scalars(
        select(Message).where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    ).all()


def list_messages_dicts(db: Session, conversation_id: uuid.UUID) -> list[dict]:
    """Messages with a resolved author name — needed so a channel can label who
    said what (in a DM it's just you vs. the other side)."""
    conv = _get(db, conversation_id)
    msgs = db.scalars(
        select(Message).where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    ).all()
    # Pre-resolve creator names for channel authors in one pass.
    names: dict[uuid.UUID, str] = {}
    if conv.kind == "channel":
        cids = {m.sender_creator_id for m in msgs if m.sender_creator_id}
        if cids:
            for creator, display_name in db.execute(
                select(Creator, CreatorProfile.display_name)
                .outerjoin(CreatorProfile, CreatorProfile.creator_id == Creator.id)
                .where(Creator.id.in_(cids))
            ).all():
                names[creator.id] = display_name or creator.email.split("@")[0]
    out = []
    for m in msgs:
        sender_name = None
        if conv.kind == "channel":
            sender_name = "Lumina Team" if m.sender_type == "admin" else names.get(m.sender_creator_id, "Creator")
        out.append({
            "id": str(m.id),
            "conversation_id": str(m.conversation_id),
            "sender_type": m.sender_type,
            "sender_admin_id": str(m.sender_admin_id) if m.sender_admin_id else None,
            "sender_creator_id": str(m.sender_creator_id) if m.sender_creator_id else None,
            "sender_name": sender_name,
            "body": m.body,
            "created_at": m.created_at,
        })
    return out


def send_message(db: Session, conversation_id: uuid.UUID, sender_type: str,
                 body: str, sender_admin_id: uuid.UUID | None = None,
                 sender_creator_id: uuid.UUID | None = None) -> Message:
    body = (body or "").strip()
    if not body:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Message can't be empty")
    conv = _get(db, conversation_id)
    now = _now()
    msg = Message(
        conversation_id=conv.id, sender_type=sender_type, body=body,
        sender_admin_id=sender_admin_id, sender_creator_id=sender_creator_id, created_at=now,
    )
    db.add(msg)
    conv.last_message_at = now
    # The sender has, by definition, read up to their own message.
    if sender_type == "admin":
        conv.admin_last_read_at = now
    elif conv.kind == "channel":
        member = _member(db, conv.id, sender_creator_id) if sender_creator_id else None
        if member is not None:
            member.last_read_at = now
    else:
        conv.creator_last_read_at = now
        # A new creator message pulls the DM back into the admin inbox.
        conv.admin_archived = False
    db.commit()
    db.refresh(msg)
    return msg


def mark_read(db: Session, conversation_id: uuid.UUID, side: str,
              creator_id: uuid.UUID | None = None) -> None:
    conv = _get(db, conversation_id)
    now = _now()
    if side == "admin":
        conv.admin_last_read_at = now
    elif conv.kind == "channel":
        member = _member(db, conv.id, creator_id) if creator_id else None
        if member is not None:
            member.last_read_at = now
    else:
        conv.creator_last_read_at = now
    db.commit()


# ── channels (group threads) ──
def create_channel(db: Session, title: str, creator_ids: list[uuid.UUID]) -> Conversation:
    title = (title or "").strip()
    if not title:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Channel needs a name")
    conv = Conversation(kind="channel", title=title)
    db.add(conv)
    db.flush()
    for cid in dict.fromkeys(creator_ids):  # de-dupe, preserve order
        db.add(ConversationMember(conversation_id=conv.id, creator_id=cid))
    db.commit()
    db.refresh(conv)
    return conv


def set_channel_muted(db: Session, conversation_id: uuid.UUID, creator_id: uuid.UUID, muted: bool) -> None:
    member = _member(db, conversation_id, creator_id)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not a member of this channel")
    member.muted = muted
    db.commit()


def list_channel_members(db: Session, conversation_id: uuid.UUID) -> list[dict]:
    rows = db.execute(
        select(Creator, CreatorProfile.display_name, CreatorProfile.whatsapp)
        .join(ConversationMember, ConversationMember.creator_id == Creator.id)
        .outerjoin(CreatorProfile, CreatorProfile.creator_id == Creator.id)
        .where(ConversationMember.conversation_id == conversation_id)
        .order_by(CreatorProfile.display_name.asc())
    ).all()
    return [
        {
            "creator_id": str(creator.id),
            "name": display_name or creator.email.split("@")[0],
            "email": creator.email,
            "whatsapp": whatsapp,
        }
        for creator, display_name, whatsapp in rows
    ]


def add_channel_members(db: Session, conversation_id: uuid.UUID, creator_ids: list[uuid.UUID]) -> None:
    conv = _get(db, conversation_id)
    if conv.kind != "channel":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not a channel")
    for cid in dict.fromkeys(creator_ids):
        if _member(db, conversation_id, cid) is None:
            db.add(ConversationMember(conversation_id=conversation_id, creator_id=cid))
    db.commit()


def remove_channel_member(db: Session, conversation_id: uuid.UUID, creator_id: uuid.UUID) -> None:
    member = _member(db, conversation_id, creator_id)
    if member is not None:
        db.delete(member)
        db.commit()


def creator_in_channel(db: Session, conversation_id: uuid.UUID, creator_id: uuid.UUID) -> bool:
    return _member(db, conversation_id, creator_id) is not None
