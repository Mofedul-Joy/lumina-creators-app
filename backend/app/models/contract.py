"""Campaign Participation Agreement models — the editable template per campaign
and the immutable generated instance per creator."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Index, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import INET, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CampaignContract(Base):
    """The editable agreement template for one campaign. `body` is full free-text
    with {{merge tokens}} the admin can rewrite entirely."""
    __tablename__ = "campaign_contracts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    title: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'Campaign Participation Agreement'"))
    subtitle: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'Independent Contractor Agreement for Creator Engagement'")
    )
    company_name: Mapped[Optional[str]] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    updated_by_admin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admins.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CreatorContract(Base):
    """A generated agreement for one creator on one campaign. `rendered_body` is a
    frozen snapshot at generation time; `document_id` is the public reference."""
    __tablename__ = "creator_contracts"
    __table_args__ = (
        UniqueConstraint("campaign_id", "creator_id", name="uq_creator_contract"),
        Index("idx_creator_contract_creator", "creator_id"),
        Index("idx_creator_contract_campaign", "campaign_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE"), nullable=False
    )
    document_id: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    subtitle: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    company_name: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    rendered_body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'sent'"))
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    viewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    accepted_name: Mapped[Optional[str]] = mapped_column(Text)
    accepted_ip: Mapped[Optional[str]] = mapped_column(INET)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
