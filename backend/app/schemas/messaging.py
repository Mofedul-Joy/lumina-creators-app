"""Messaging schemas."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ConversationOut(BaseModel):
    id: str
    kind: str = "dm"                # 'dm' | 'channel'
    creator_id: Optional[str] = None  # null for channels
    name: str                       # counterparty display name / channel name
    email: Optional[str] = None     # counterparty email (for the email button)
    whatsapp: Optional[str] = None  # counterparty WhatsApp (admin DM rows)
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    last_sender: Optional[str] = None  # 'admin' | 'creator'
    unread: bool = False
    muted: bool = False
    archived: bool = False
    member_count: Optional[int] = None  # channels only


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_type: str                # 'admin' | 'creator'
    sender_admin_id: Optional[str] = None
    sender_creator_id: Optional[str] = None
    sender_name: Optional[str] = None  # resolved author label (channels)
    body: str
    created_at: datetime


class MessageIn(BaseModel):
    body: str


class StartConversationIn(BaseModel):
    creator_id: UUID  # pydantic validates format → 422 (not a 500) on bad input


class UnreadCountOut(BaseModel):
    unread: int = 0


class MutedIn(BaseModel):
    muted: bool


class ArchivedIn(BaseModel):
    archived: bool


class ConversationInfoOut(BaseModel):
    message_count: int = 0
    first_message_at: Optional[datetime] = None
    last_message_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class ContractHistoryItem(BaseModel):
    document_id: str
    title: str
    campaign_name: str
    status: str
    sent_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


# ── channels ──
class CreateChannelIn(BaseModel):
    title: str
    creator_ids: list[UUID] = []


class ChannelMembersIn(BaseModel):
    creator_ids: list[UUID] = []


class ChannelMemberOut(BaseModel):
    creator_id: str
    name: str
    email: Optional[str] = None
    whatsapp: Optional[str] = None
