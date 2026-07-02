from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, Text, func, text
from sqlalchemy.dialects.postgresql import CITEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import ADMIN_ROLE, CLIENT_STATUS, CREATOR_STATUS, SIGNUP_SOURCE


class Creator(TimestampMixin, Base):
    __tablename__ = "creators"
    __table_args__ = (
        CheckConstraint(
            "signup_source <> 'self' OR password_hash IS NOT NULL",
            name="chk_self_signup_has_password",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    email: Mapped[str] = mapped_column(CITEXT(), unique=True, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        CREATOR_STATUS, nullable=False, server_default=text("'pending'")
    )
    signup_source: Mapped[str] = mapped_column(
        SIGNUP_SOURCE, nullable=False, server_default=text("'self'")
    )
    email_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    email_verification_code_hash: Mapped[Optional[str]] = mapped_column(Text)
    email_verification_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    email_verification_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    email: Mapped[str] = mapped_column(CITEXT(), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(ADMIN_ROLE, nullable=False, server_default=text("'admin'"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Client(TimestampMixin, Base):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    email: Mapped[str] = mapped_column(CITEXT(), unique=True, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(Text)
    name: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        CLIENT_STATUS, nullable=False, server_default=text("'active'")
    )
