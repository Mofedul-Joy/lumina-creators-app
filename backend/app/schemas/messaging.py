"""Messaging schemas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ConversationOut(BaseModel):
    id: str
    creator_id: str
    name: str                       # counterparty display name
    email: Optional[str] = None     # counterparty email (for the email button)
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    last_sender: Optional[str] = None  # 'admin' | 'creator'
    unread: bool = False
    muted: bool = False
    archived: bool = False


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_type: str                # 'admin' | 'creator'
    sender_admin_id: Optional[str] = None
    body: str
    created_at: datetime


class MessageIn(BaseModel):
    body: str


class StartConversationIn(BaseModel):
    creator_id: str


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
