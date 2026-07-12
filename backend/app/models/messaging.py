"""Direct messaging between the admin/company side and creators.

Two conversation kinds:
- 'dm'      — the 1:1 company↔creator thread (exactly one per creator). Read
              state lives on the conversation's admin_/creator_ watermarks.
- 'channel' — a group thread the admin runs with many creators. Membership +
              per-member read state live in `conversation_members`; the admin
              side still uses the conversation's admin_ watermark.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (Index("idx_conversation_last_msg", "last_message_at"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    kind: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'dm'"))  # 'dm' | 'channel'
    # DM: one thread per creator (unique → race-safe get-or-create). Channels
    # carry no single creator (creator_id NULL) and identify by `title`.
    creator_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE"),
        unique=True, nullable=True,
    )
    title: Mapped[Optional[str]] = mapped_column(Text)  # channel name (null for DMs)
    # Per-side read watermarks — a message newer than the side's watermark is
    # unread for that side.
    admin_last_read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    creator_last_read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    # Per-side "mute" — a muted conversation still receives messages but stops
    # contributing to that side's unread badge.
    admin_muted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    creator_muted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    # Admin-side "leave conversation" = archive it out of the inbox list. It
    # un-archives automatically when the creator sends a new message.
    admin_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (Index("idx_message_conv_created", "conversation_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    sender_type: Mapped[str] = mapped_column(Text, nullable=False)  # 'admin' | 'creator'
    # Which admin sent it (null for creator-sent messages) — lets us show the
    # author on the company side.
    sender_admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admins.id")
    )
    # Which creator sent it — implicit in a DM, but needed to label authors in a
    # channel where many creators post.
    sender_creator_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creators.id", ondelete="SET NULL")
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ConversationMember(Base):
    """A creator's membership in a channel, with their own read watermark + mute."""
    __tablename__ = "conversation_members"
    __table_args__ = (
        Index("idx_conv_member_unique", "conversation_id", "creator_id", unique=True),
        Index("idx_conv_member_creator", "creator_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE"), nullable=False
    )
    last_read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    muted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
