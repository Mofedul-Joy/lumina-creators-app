"""Direct messaging between the admin/company side and creators.

Phase 1 is 1:1 DMs: exactly one Conversation per creator, shared by the admin
team (any admin can read/reply). Read state is tracked per side so each side
gets its own unread badge. Channels/group threads come in a later phase.
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
    # One thread per creator (the company↔creator DM). Unique so get-or-create
    # is race-safe on the DB.
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE"),
        unique=True, nullable=False,
    )
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
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
