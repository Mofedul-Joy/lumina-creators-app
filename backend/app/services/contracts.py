"""Campaign Participation Agreements.

The admin edits one free-text template per campaign (`campaign_contracts.body`)
with {{merge tokens}}. When a creator joins, we render the template against the
campaign + creator and freeze the result into a `creator_contracts` row, then
notify + email them a link to view and (optionally) accept it. Editing the
template later never changes a contract already generated — the snapshot is
immutable.
"""
from __future__ import annotations

import re
import secrets
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import _now
from app.integrations import email as email_svc
from app.models import Campaign, CampaignContract, Client, Creator, CreatorContract, CreatorProfile
from app.services import notifications

# ── Merge tokens the template understands ────────────────────────────────────
# {{company}} {{creator}} {{creator_email}} {{campaign}} {{effective_date}}
# {{start_date}} {{campaign_term}} {{compensation}} {{payment_schedule}}
# {{platforms}} {{content_guidelines}} {{document_id}} {{generated_at}}
MERGE_TOKENS = [
    "company", "creator", "creator_email", "campaign", "effective_date",
    "start_date", "campaign_term", "compensation", "payment_schedule",
    "platforms", "content_guidelines", "document_id", "generated_at",
]

# The seed template. Admins can rewrite any of it; tokens fill per creator.
DEFAULT_TEMPLATE = """\
## {{title}}

WHEREAS, {{company}} operates the {{campaign}} campaign and seeks to retain qualified creators for campaign deliverables; and

WHEREAS, {{creator}} possesses the skill and expertise necessary to produce the deliverables contemplated herein;

NOW, THEREFORE, in consideration of the mutual promises and covenants contained in this Agreement, the parties agree as follows:

### Key Contract Information

- **Company:** {{company}}
- **Creator:** {{creator}}
- **Creator Email:** {{creator_email}}
- **Campaign:** {{campaign}}
- **Campaign Term:** {{campaign_term}}
- **Effective Date:** {{effective_date}}

### 1. Definitions

1. "Agreement" means this Campaign Participation Agreement, including any schedules or exhibits attached hereto.
2. "Deliverables" means the content, assets, or services to be produced by Creator as described in the Campaign requirements.
3. "Program Term" means the period during which Creator is authorized to participate in the Program, as set forth above or as subsequently amended in writing.
4. "Platform Policies" means the rules, community guidelines, and terms of service of any social or digital platform on which Deliverables are published.

### 2. Campaign Overview

{{content_guidelines}}

### 3. Compensation & Payment Terms

{{compensation}}

Payment schedule: {{payment_schedule}}.

3.1 Metrics & Eligibility. "Qualifying Views" mean views reported by the applicable social platform's native analytics for the Creator account(s) connected through Lumina Creators at the time of posting, excluding organic media, incentivized traffic, non-human/bot traffic, and known invalid activity. Company reserves the right, in its reasonable discretion, to exclude from payment any Deliverable that fails to comply with the brand guidelines stated in this Agreement or is determined to have been artificially inflated through view-botting or other fraudulent means.

3.2 Payment Scheduling & Processing. Payments will follow the cadence stated above. Lumina Creators may act as payment agent for Company to transmit funds to Creator. Company remains responsible for funding all approved payments.

3.3 Statements; Objections; No Setoff. Any objection to a payment statement must be raised within five (5) business days of the statement date; otherwise the statement is deemed accepted. Undisputed amounts must be paid when due.

### 4. Deliverables & Participation Requirements

Required platforms: {{platforms}}.

Content Guidelines:
{{content_guidelines}}

4.2 Availability of Deliverables. Creator shall keep each approved Deliverable publicly accessible and not delete, hide, or restrict it for a period of ninety (90) consecutive days from its initial posting date, unless removal is required by platform policy, law, or Company's written request.

4.3 Handle Integrity; Cooperation. Creator will maintain and provide connection to the specified account handle(s) for the duration of the Campaign. Any handle change must be notified within forty-eight (48) hours and re-connected in Lumina Creators.

### 5. Relationship of the Parties

Creator participates in the Campaign as an independent contractor and not as an employee, agent, or representative of Company. Nothing herein creates a partnership, joint venture, employer-employee, or agency relationship. Creator is solely responsible for all taxes, withholdings, insurance, and other obligations associated with their services.

### 6. Content Rights & Usage

Subject to Creator's ownership of original content, Creator grants Company a non-exclusive, royalty-free, worldwide license to use, repost, and amplify Deliverables on Company-controlled channels for the duration of the Campaign Term and any reasonable campaign recap period thereafter. Creator warrants that Deliverables shall be original and shall not infringe the rights of any third party.

### 7. Compliance & Brand Safety

Creator shall comply with all applicable laws, advertising standards, platform policies, and the U.S. Federal Trade Commission's endorsement guidelines. Creator agrees to promptly edit or remove Deliverables upon Company's reasonable request for compliance or brand safety reasons.

### 8. Term, Suspension & Termination

8.1 Term. This Agreement commences on the Effective Date and continues through the Campaign Term unless earlier terminated as provided herein.

8.2 Termination for Cause. Either party may terminate upon written notice if the other materially breaches any obligation and fails to cure within five (5) business days after notice.

8.3 Effect of Termination. Creator will be compensated for all approved Deliverables completed and accepted prior to the effective termination date, provided they meet the guidelines stated in this Agreement.

### 9. Confidentiality

Creator shall maintain in confidence all non-public information disclosed by Company, including campaign briefs, rates, platform data, and audience insights. This obligation survives termination of the Agreement.

### 10. Indemnification & Limitation of Liability

Each party will indemnify, defend, and hold harmless the other from third-party claims arising out of its breach of this Agreement, willful misconduct, or content it supplies. Neither party will be liable for indirect, incidental, special, or consequential damages.

### 11. General Provisions

This Agreement embodies the entire understanding of the parties and supersedes all prior agreements concerning the subject matter hereof. Any amendments must be in writing and signed (including electronically) by both parties. If any provision is held invalid, the remaining provisions shall remain in full force.

---

**For Company:** {{company}}

**For Creator:** {{creator}}

Electronic acceptance or signature captured through the Lumina Creators platform is deemed equivalent to a handwritten signature for all legal purposes.

_Document ID: {{document_id}} · Generated via Lumina Creators · {{generated_at}}_
"""


def _fmt_money(v: Decimal | float | int | None) -> str:
    return f"${Decimal(v or 0):,.2f}"


def _schedule_label(sched: str | None) -> str:
    return {
        "every_7_days": "every 7 days",
        "every_14_days": "every 14 days",
        "every_30_days": "every 30 days",
    }.get(sched or "", "as scheduled by the Company")


def _compensation_line(c: Campaign) -> str:
    pt = c.payment_type or "cpm"
    if pt == "fixed":
        return f"Fixed compensation: {_fmt_money(c.fixed_amount)} paid as scheduled by the Company."
    if pt == "per_post":
        return f"Per-post compensation: {_fmt_money(c.per_post_amount)} per approved post."
    if pt == "per_hour":
        return f"Hourly compensation: {_fmt_money(c.hourly_rate)} per hour for {c.required_hours or 0} hour(s)."
    if pt == "mixed":
        return (f"Fixed compensation of {_fmt_money(c.fixed_amount)} plus {_fmt_money(c.cpm_rate)} "
                f"per 1,000 qualifying views.")
    return f"Performance compensation: {_fmt_money(c.cpm_rate)} per 1,000 qualifying views."


def company_name(db: Session, c: Campaign, contract: CampaignContract | None = None) -> str:
    if contract and contract.company_name:
        return contract.company_name
    if c.brand_name:
        return c.brand_name
    if c.client_id:
        client = db.get(Client, c.client_id)
        if client and client.name:
            return client.name
    return "Lumina Creators"


def _campaign_term(c: Campaign) -> str:
    start = c.starts_at.strftime("%B %d, %Y") if c.starts_at else "the Effective Date"
    if c.ends_at:
        return f"Commencing {start} and continuing until {c.ends_at.strftime('%B %d, %Y')}."
    return f"Commencing {start} and continuing until terminated pursuant to Section 8."


def _merge(body: str, ctx: dict[str, str]) -> str:
    def repl(m: re.Match) -> str:
        key = m.group(1).strip()
        return ctx.get(key, m.group(0))  # leave unknown tokens visible rather than blank
    return re.sub(r"\{\{\s*([a-zA-Z_]+)\s*\}\}", repl, body)


def _context(db: Session, c: Campaign, contract: CampaignContract, creator: Creator | None,
             document_id: str) -> dict[str, str]:
    prof = None
    if creator is not None:
        prof = db.scalar(select(CreatorProfile).where(CreatorProfile.creator_id == creator.id))
    creator_name = (prof.display_name if prof and prof.display_name else None) or \
        (creator.email.split("@")[0] if creator else "Creator")
    now = _now()
    return {
        "title": contract.title,
        "company": company_name(db, c, contract),
        "creator": creator_name,
        "creator_email": creator.email if creator else "[creator email]",
        "campaign": c.name,
        "effective_date": now.strftime("%B %d, %Y"),
        "start_date": c.starts_at.strftime("%B %d, %Y") if c.starts_at else now.strftime("%B %d, %Y"),
        "campaign_term": _campaign_term(c),
        "compensation": _compensation_line(c),
        "payment_schedule": _schedule_label(c.payment_schedule),
        "platforms": ", ".join(c.platforms) if c.platforms else "None",
        "content_guidelines": (c.description or "See campaign requirements.").strip(),
        "document_id": document_id,
        "generated_at": now.strftime("%m/%d/%Y, %I:%M %p"),
    }


# ── Template (per campaign) ───────────────────────────────────────────────────
def get_or_create_template(db: Session, campaign_id: uuid.UUID) -> CampaignContract:
    contract = db.scalar(select(CampaignContract).where(CampaignContract.campaign_id == campaign_id))
    if contract is not None:
        return contract
    c = db.get(Campaign, campaign_id)
    contract = CampaignContract(
        campaign_id=campaign_id,
        company_name=(c.brand_name if c else None),
        body=DEFAULT_TEMPLATE,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract


def update_template(db: Session, campaign_id: uuid.UUID, admin_id: uuid.UUID, fields: dict) -> CampaignContract:
    contract = get_or_create_template(db, campaign_id)
    for k in ("title", "subtitle", "company_name", "body"):
        if k in fields and fields[k] is not None:
            setattr(contract, k, fields[k])
    contract.updated_by_admin_id = admin_id
    contract.updated_at = _now()
    db.commit()
    db.refresh(contract)
    return contract


def render_preview(db: Session, campaign_id: uuid.UUID) -> str:
    """Admin preview — merged against a placeholder creator."""
    c = db.get(Campaign, campaign_id)
    contract = get_or_create_template(db, campaign_id)
    ctx = _context(db, c, contract, None, "PREVIEW")
    ctx["creator"] = "[Creator name]"
    return _merge(contract.body, ctx)


# ── Instance (per creator) ────────────────────────────────────────────────────
def generate_for_creator(db: Session, campaign_id: uuid.UUID, creator_id: uuid.UUID,
                         notify: bool = True) -> CreatorContract | None:
    """Idempotent: one contract per (campaign, creator). Renders + freezes a
    snapshot, then notifies + emails the creator. Best-effort on delivery."""
    existing = db.scalar(
        select(CreatorContract).where(
            CreatorContract.campaign_id == campaign_id,
            CreatorContract.creator_id == creator_id,
        )
    )
    if existing is not None:
        return existing
    c = db.get(Campaign, campaign_id)
    creator = db.get(Creator, creator_id)
    if c is None or creator is None:
        return None
    contract = get_or_create_template(db, campaign_id)
    document_id = secrets.token_urlsafe(12)
    ctx = _context(db, c, contract, creator, document_id)
    row = CreatorContract(
        campaign_id=campaign_id, creator_id=creator_id, document_id=document_id,
        title=contract.title, subtitle=contract.subtitle,
        company_name=company_name(db, c, contract),
        rendered_body=_merge(contract.body, ctx), status="sent", sent_at=_now(),
    )
    db.add(row)
    db.flush()
    if notify:
        try:
            notifications.push(
                db, creator_id, kind="contract",
                title=f"Your agreement for {c.name}",
                body="Your Campaign Participation Agreement is ready. Tap to review and sign.",
                link=f"/contracts/{document_id}", commit=False,
            )
        except Exception:  # noqa: BLE001
            pass
    db.commit()
    db.refresh(row)
    if notify:
        try:
            link = f"{(get_settings().frontend_url or '').rstrip('/')}/contracts/{document_id}"
            email_svc.send_contract_ready(creator.email, c.name, link)
        except Exception:  # noqa: BLE001
            pass
    return row


def list_for_campaign(db: Session, campaign_id: uuid.UUID) -> list[dict]:
    rows = db.scalars(
        select(CreatorContract).where(CreatorContract.campaign_id == campaign_id)
        .order_by(CreatorContract.created_at.desc())
    ).all()
    out = []
    for r in rows:
        creator = db.get(Creator, r.creator_id)
        out.append({
            "id": str(r.id),
            "document_id": r.document_id,
            "creator_email": creator.email if creator else None,
            "status": r.status,
            "sent_at": r.sent_at,
            "accepted_at": r.accepted_at,
            "accepted_name": r.accepted_name,
        })
    return out


def active_count(db: Session, campaign_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count()).select_from(CreatorContract).where(
            CreatorContract.campaign_id == campaign_id,
            CreatorContract.status == "accepted",
        )
    ) or 0


# ── Creator-facing ────────────────────────────────────────────────────────────
def get_for_creator(db: Session, document_id: str, creator_id: uuid.UUID, mark_viewed: bool = True) -> CreatorContract:
    from fastapi import HTTPException, status
    row = db.scalar(select(CreatorContract).where(CreatorContract.document_id == document_id))
    if row is None or row.creator_id != creator_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contract not found")
    if mark_viewed and row.status == "sent":
        row.status = "viewed"
        row.viewed_at = _now()
        db.commit()
        db.refresh(row)
    return row


def list_mine(db: Session, creator_id: uuid.UUID) -> list[CreatorContract]:
    return list(db.scalars(
        select(CreatorContract).where(CreatorContract.creator_id == creator_id)
        .order_by(CreatorContract.created_at.desc())
    ).all())


def accept(db: Session, document_id: str, creator_id: uuid.UUID, name: str, ip: str | None) -> CreatorContract:
    from fastapi import HTTPException, status
    row = db.scalar(select(CreatorContract).where(CreatorContract.document_id == document_id))
    if row is None or row.creator_id != creator_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Contract not found")
    if not name.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Type your full name to sign.")
    if row.status != "accepted":
        row.status = "accepted"
        row.accepted_at = _now()
        row.accepted_name = name.strip()
        row.accepted_ip = ip
        db.commit()
        db.refresh(row)
    return row
