"""Admin → campaign invites (the "Add creators" flow).

Two audiences, one table (`campaign_invites`):

* Existing creators — `creator_id` set. Delivered as an in-app notification
  (bell, click-through to the campaign) AND an email to their account. They
  accept by opening the campaign and joining; the join marks the invite accepted.
* Outsiders — `email` + `token` set. Emailed a `/signup?invite=<token>` link;
  signup auto-joins them to the campaign (see `accept_external`).
* Link-only — both null. The reusable "Copy invite link" target; never consumed.

Every delivery is best-effort: a missing mail transport or a notification write
must not fail the invite, so the admin always gets a usable summary + link.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import _now
from app.integrations import email as email_svc
from app.models import Campaign, CampaignInvite, CampaignParticipation, Creator
from app.services import notifications

INVITE_TTL_DAYS = 30


def _signup_link(token: str) -> str:
    base = (get_settings().frontend_url or "").rstrip("/")
    return f"{base}/signup?invite={token}"


def _campaign_path(slug: str) -> str:
    # Relative — the notification client routes to it; also used for the email
    # deep link once combined with frontend_url.
    return f"/campaigns/{slug}"


def _campaign_url(slug: str) -> str:
    base = (get_settings().frontend_url or "").rstrip("/")
    return f"{base}{_campaign_path(slug)}"


def _get_campaign(db: Session, campaign_id: uuid.UUID) -> Campaign:
    c = db.get(Campaign, campaign_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
    return c


def _open_invite_exists(db: Session, campaign_id: uuid.UUID, creator_id: uuid.UUID) -> bool:
    return db.scalar(
        select(CampaignInvite.id).where(
            CampaignInvite.campaign_id == campaign_id,
            CampaignInvite.creator_id == creator_id,
            CampaignInvite.accepted_at.is_(None),
            CampaignInvite.declined_at.is_(None),
            CampaignInvite.revoked_at.is_(None),
        )
    ) is not None


def _already_active(db: Session, campaign_id: uuid.UUID, creator_id: uuid.UUID) -> bool:
    return db.scalar(
        select(CampaignParticipation.id).where(
            CampaignParticipation.campaign_id == campaign_id,
            CampaignParticipation.creator_id == creator_id,
            CampaignParticipation.removed_at.is_(None),
        )
    ) is not None


def invite(db: Session, admin_id: uuid.UUID, campaign_id: uuid.UUID,
           creator_ids: list[uuid.UUID] | None = None,
           emails: list[str] | None = None) -> dict:
    """Invite existing creators and/or outsiders to a campaign. Returns a summary
    the admin UI shows as a toast."""
    campaign = _get_campaign(db, campaign_id)
    invited_existing = 0
    invited_external = 0
    skipped: list[str] = []
    emailed = 0

    for cid in creator_ids or []:
        creator = db.get(Creator, cid)
        if creator is None:
            skipped.append("unknown creator")
            continue
        if _already_active(db, campaign_id, cid):
            skipped.append(creator.email or "creator (already active)")
            continue
        if _open_invite_exists(db, campaign_id, cid):
            skipped.append(creator.email or "creator (already invited)")
            continue
        inv = CampaignInvite(
            campaign_id=campaign_id, creator_id=cid, created_by_admin_id=admin_id,
            expires_at=_now() + timedelta(days=INVITE_TTL_DAYS),
        )
        db.add(inv)
        db.flush()
        # In-app notification — the convenient click-through to the campaign.
        try:
            notifications.push(
                db, cid, kind="campaign_invite",
                title=f"You're invited to {campaign.name}",
                body="An admin invited you to join this campaign. Tap to view and join.",
                link=_campaign_path(campaign.slug), commit=False,
            )
        except Exception:  # noqa: BLE001 - notification is a side effect, never block
            pass
        # Email to their account (best-effort).
        try:
            if creator.email and email_svc.send_campaign_invite(
                creator.email, campaign.name, _campaign_url(campaign.slug), existing=True
            ):
                inv.email_sent = True
                emailed += 1
        except Exception:  # noqa: BLE001
            pass
        invited_existing += 1

    for raw in emails or []:
        addr = (raw or "").strip().lower()
        if not addr:
            continue
        # Already a creator? Route through the existing-creator path instead of
        # emailing a signup link to someone who already has an account.
        existing = db.scalar(select(Creator).where(Creator.email == addr))
        if existing is not None:
            sub = invite(db, admin_id, campaign_id, creator_ids=[existing.id])
            invited_existing += sub["invited_existing"]
            emailed += sub["emailed"]
            skipped += sub["skipped"]
            continue
        inv = CampaignInvite(
            campaign_id=campaign_id, email=addr, token=secrets.token_urlsafe(24),
            created_by_admin_id=admin_id, expires_at=_now() + timedelta(days=INVITE_TTL_DAYS),
        )
        db.add(inv)
        db.flush()
        try:
            if email_svc.send_campaign_invite(
                addr, campaign.name, _signup_link(inv.token), existing=False
            ):
                inv.email_sent = True
                emailed += 1
        except Exception:  # noqa: BLE001
            pass
        invited_external += 1

    db.commit()
    return {
        "invited_existing": invited_existing,
        "invited_external": invited_external,
        "emailed": emailed,
        "skipped": skipped,
    }


def invite_link(db: Session, admin_id: uuid.UUID, campaign_id: uuid.UUID) -> dict:
    """The reusable "Copy invite link". Backed by one persistent link-only invite
    (email + creator_id null) per campaign, so the same URL keeps working."""
    campaign = _get_campaign(db, campaign_id)
    inv = db.scalar(
        select(CampaignInvite).where(
            CampaignInvite.campaign_id == campaign_id,
            CampaignInvite.creator_id.is_(None),
            CampaignInvite.email.is_(None),
            CampaignInvite.revoked_at.is_(None),
        )
    )
    if inv is None:
        inv = CampaignInvite(
            campaign_id=campaign_id, token=secrets.token_urlsafe(24),
            created_by_admin_id=admin_id,
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)
    return {"link": _signup_link(inv.token)}


def accept_external(db: Session, token: str, creator_id: uuid.UUID) -> None:
    """Called from creator signup. If `token` is a campaign invite, join the new
    creator to the campaign. Idempotent; a non-campaign token is a clean no-op so
    it can be called alongside the platform-invite accept."""
    inv = db.scalar(select(CampaignInvite).where(CampaignInvite.token == token))
    if inv is None or inv.revoked_at is not None:
        return
    if inv.expires_at and inv.expires_at < _now():
        return
    _direct_join(db, inv.campaign_id, creator_id)
    # A link-only invite (no email, no creator) is reusable — don't consume it.
    if inv.email is not None:
        inv.accepted_at = inv.accepted_at or _now()
        inv.accepted_creator_id = inv.accepted_creator_id or creator_id
    db.commit()


def mark_accepted_on_join(db: Session, campaign_id: uuid.UUID, creator_id: uuid.UUID) -> None:
    """When an invited creator joins the campaign the normal way, close their open
    invite. Best-effort; called from the join endpoint."""
    inv = db.scalar(
        select(CampaignInvite).where(
            CampaignInvite.campaign_id == campaign_id,
            CampaignInvite.creator_id == creator_id,
            CampaignInvite.accepted_at.is_(None),
            CampaignInvite.declined_at.is_(None),
            CampaignInvite.revoked_at.is_(None),
        )
    )
    if inv is None:
        return
    inv.accepted_at = _now()
    inv.accepted_creator_id = creator_id
    db.commit()


def _direct_join(db: Session, campaign_id: uuid.UUID, creator_id: uuid.UUID) -> None:
    """Create a participation without the profile-completeness gate — the invite
    IS the authorization. A brand-new signup has no profile yet; they complete it
    before submitting. Skips if already participating."""
    if _already_active(db, campaign_id, creator_id):
        return
    existing = db.scalar(
        select(CampaignParticipation).where(
            CampaignParticipation.campaign_id == campaign_id,
            CampaignParticipation.creator_id == creator_id,
        )
    )
    if existing is not None:  # removed row — don't silently re-add
        return
    db.add(CampaignParticipation(campaign_id=campaign_id, creator_id=creator_id))
    db.flush()
    # Send their agreement too (best-effort — the join is what matters).
    try:
        from app.services import contracts
        contracts.generate_for_creator(db, campaign_id, creator_id)
    except Exception:  # noqa: BLE001
        pass


def list_for_campaign(db: Session, campaign_id: uuid.UUID) -> list[dict]:
    rows = db.scalars(
        select(CampaignInvite)
        .where(CampaignInvite.campaign_id == campaign_id,
               CampaignInvite.creator_id.isnot(None) | CampaignInvite.email.isnot(None))
        .order_by(CampaignInvite.created_at.desc())
    ).all()
    out: list[dict] = []
    for i in rows:
        target = i.email
        if i.creator_id:
            c = db.get(Creator, i.creator_id)
            target = (c.email if c else None) or "creator"
        out.append({
            "id": str(i.id),
            "target": target,
            "kind": "existing" if i.creator_id else "external",
            "status": _status(i),
            "email_sent": i.email_sent,
            "created_at": i.created_at,
        })
    return out


def pending_count(db: Session, campaign_id: uuid.UUID) -> int:
    from sqlalchemy import func
    return db.scalar(
        select(func.count()).select_from(CampaignInvite).where(
            CampaignInvite.campaign_id == campaign_id,
            CampaignInvite.creator_id.isnot(None) | CampaignInvite.email.isnot(None),
            CampaignInvite.accepted_at.is_(None),
            CampaignInvite.declined_at.is_(None),
            CampaignInvite.revoked_at.is_(None),
        )
    ) or 0


def revoke(db: Session, campaign_id: uuid.UUID, invite_id: uuid.UUID) -> None:
    inv = db.get(CampaignInvite, invite_id)
    if inv is None or inv.campaign_id != campaign_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invite not found")
    inv.revoked_at = _now()
    db.commit()


def _status(i: CampaignInvite) -> str:
    if i.accepted_at:
        return "accepted"
    if i.declined_at:
        return "declined"
    if i.revoked_at:
        return "revoked"
    return "pending"
