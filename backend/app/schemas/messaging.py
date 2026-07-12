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
