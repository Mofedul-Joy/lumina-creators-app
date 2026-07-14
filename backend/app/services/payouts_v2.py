"""Payouts engine (Feature 4, BUILD_SPEC.md §3.6) — auto-calc'd owed amounts
per campaign payment_type + bonus milestones, Pay All, the system Wallet +
ledger, and a simple per-campaign spend Forecast.

Kept in a separate module from `payouts.py` (submission-level manual payout
flow) so neither surface has to touch the other's assumptions — this module
is campaign/participation-level and wallet-backed; `payouts.py` remains the
existing per-submission/manual "receipt" flow untouched.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Iterable, Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.integrations import storage
from app.models import (
    Campaign,
    CampaignBonusMilestone,
    CampaignParticipation,
    CreatorProfile,
    Payout,
    PayoutItem,
    StorageObject,
    Submission,
    Wallet,
    WalletTransaction,
)
from app.services import audit

_CENTS = Decimal("0.01")
_ZERO = Decimal("0")


def _now():
    return datetime.now(timezone.utc)


def _q(amount) -> Decimal:
    # ROUND_HALF_UP to match compute_estimated_amount (scrape_worker) — otherwise
    # the two payout code paths round half-cents differently and drift apart.
    return Decimal(amount or 0).quantize(_CENTS, rounding=ROUND_HALF_UP)


# ── auto-calc ────────────────────────────────────────────────────────────────

def _approved_submission_count(db: Session, campaign_id: uuid.UUID, creator_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count()).select_from(Submission).where(
            Submission.campaign_id == campaign_id,
            Submission.creator_id == creator_id,
            Submission.verification_status == "verified",
        )
    ) or 0


def _total_views(db: Session, campaign_id: uuid.UUID, creator_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.coalesce(func.sum(Submission.views), 0)).where(
            Submission.campaign_id == campaign_id,
            Submission.creator_id == creator_id,
            Submission.verification_status == "verified",
        )
    ) or 0


def _cpm_earnings_snapshot(db: Session, campaign_id: uuid.UUID, creator_id: uuid.UUID) -> Decimal:
    """CPM earnings summed from each verified submission's stored
    `estimated_amount` — which the scrape worker computed from that post's
    `cpm_rate_snapshot` at scrape time. Using the snapshot (not the live
    `campaign.cpm_rate`) means a later admin rate-edit can't retroactively
    inflate owed on already-paid views, and keeps `gross` equal to the sum of
    the PayoutItem rows actually written (same verified + non-suspicious filter)."""
    total = db.scalar(
        select(func.coalesce(func.sum(Submission.estimated_amount), 0)).where(
            Submission.campaign_id == campaign_id,
            Submission.creator_id == creator_id,
            Submission.verification_status == "verified",
            Submission.is_suspicious.is_(False),
        )
    )
    return _q(total)


def _already_paid_for_participation(db: Session, campaign_id: uuid.UUID, creator_id: uuid.UUID) -> Decimal:
    """Sum of prior payouts already recorded against this creator+campaign
    (via the new campaign_id-tagged Payout rows) — subtracted from the fresh
    auto-calc so re-running owed doesn't re-charge what's already been paid."""
    total = db.scalar(
        select(func.coalesce(func.sum(Payout.amount), 0)).where(
            Payout.campaign_id == campaign_id,
            Payout.creator_id == creator_id,
            Payout.status == "paid",
        )
    )
    return _q(total)


def compute_owed_for_participation(
    db: Session, participation: CampaignParticipation, campaign: Campaign
) -> dict:
    """Compute the owed breakdown for one creator on one campaign per the
    auto-calc rule (BUILD_SPEC.md §3.6):
      fixed    -> fixed_amount once
      cpm      -> (views / 1000) * cpm_rate
      mixed    -> fixed_amount + (views / 1000) * cpm_rate
      per_hour -> 0 in MVP
      per_post -> approved_submission_count * per_post_amount
      + bonus milestones not yet awarded to this participation.
    """
    creator_id = participation.creator_id
    campaign_id = campaign.id
    payment_type = campaign.payment_type or "cpm"

    total_views = _total_views(db, campaign_id, creator_id)
    approved_count = _approved_submission_count(db, campaign_id, creator_id)

    fixed = _ZERO
    cpm = _ZERO
    per_post = _ZERO

    if payment_type == "fixed":
        fixed = _q(campaign.fixed_amount)
    elif payment_type == "cpm":
        cpm = _cpm_earnings_snapshot(db, campaign_id, creator_id)
    elif payment_type == "mixed":
        fixed = _q(campaign.fixed_amount)
        cpm = _cpm_earnings_snapshot(db, campaign_id, creator_id)
    elif payment_type == "per_post":
        per_post = _q(Decimal(approved_count) * Decimal(campaign.per_post_amount or 0))
    # per_hour -> 0 in MVP, nothing to add.

    # bonus milestones: award once, tracked on the participation.
    awarded_ids = set(participation.payout_awarded_bonus_ids or [])
    milestones = db.scalars(
        select(CampaignBonusMilestone).where(CampaignBonusMilestone.campaign_id == campaign_id)
    ).all()
    milestone_total = _ZERO
    newly_eligible_ids: list[uuid.UUID] = []
    for m in milestones:
        if m.id in awarded_ids:
            continue
        if total_views >= (m.views_threshold or 0):
            milestone_total += _q(m.bonus_amount)
            newly_eligible_ids.append(m.id)

    gross = _q(fixed + cpm + per_post + milestone_total)
    already_paid = _already_paid_for_participation(db, campaign_id, creator_id)
    net = gross - already_paid
    if net < 0:
        net = _ZERO

    return {
        "campaign": campaign,
        "participation": participation,
        "total_views": total_views,
        "approved_count": approved_count,
        "fixed": fixed,
        "cpm": cpm,
        "per_post": per_post,
        "milestones": milestone_total,
        "gross": gross,
        "already_paid": already_paid,
        "net_owed": net,
        "newly_eligible_bonus_ids": newly_eligible_ids,
    }


def _avatar_url(db: Session, profile: Optional[CreatorProfile]) -> Optional[str]:
    if not profile or not profile.avatar_object_id:
        return None
    obj = db.get(StorageObject, profile.avatar_object_id)
    if not obj:
        return None
    return storage.object_public_url(obj.object_key)


def _default_payment_method(db: Session, creator_id: uuid.UUID) -> tuple[Optional[str], Optional[str]]:
    prof = db.scalar(select(CreatorProfile).where(CreatorProfile.creator_id == creator_id))
    if not prof:
        return None, None
    return prof.payout_method, prof.payout_address


def compute_owed_all(db: Session) -> list[dict]:
    """One row per (creator, campaign) with net_owed > 0 across all active/
    completed campaigns — the source for GET /owed-v2."""
    rows: list[dict] = []
    campaigns = db.scalars(
        select(Campaign).where(Campaign.status.in_(["active", "paused", "completed"]))
    ).all()
    if not campaigns:
        return rows

    profiles = {
        p.creator_id: p
        for p in db.scalars(select(CreatorProfile)).all()
    }

    for campaign in campaigns:
        # Eligibility keys off accepted_at (set the moment a creator joins under
        # the Rev2 no-approval flow), NOT the pipeline `status` enum. The enum
        # stays "joined" for auto-accepted creators, so the old status filter
        # made every such creator invisible to payouts — they'd never get paid.
        participations = db.scalars(
            select(CampaignParticipation).where(
                CampaignParticipation.campaign_id == campaign.id,
                CampaignParticipation.accepted_at.is_not(None),
                CampaignParticipation.removed_at.is_(None),
            )
        ).all()
        for part in participations:
            calc = compute_owed_for_participation(db, part, campaign)
            if calc["net_owed"] <= 0:
                continue
            prof = profiles.get(part.creator_id)
            method, address = (prof.payout_method, prof.payout_address) if prof else (None, None)
            rows.append({
                "creator_id": str(part.creator_id),
                "display_name": prof.display_name if prof else None,
                "avatar_url": _avatar_url(db, prof),
                "amount_owed": calc["net_owed"],
                "start_date": part.joined_at,
                "due_date": campaign.ends_at.date() if campaign.ends_at else None,
                "program_name": campaign.name,
                "campaign_id": str(campaign.id),
                "unpaid_posts": calc["approved_count"],
                "total_views": calc["total_views"],
                "total_earnings_to_date": calc["already_paid"] + calc["net_owed"],
                "payout_method": method,
                "payout_address": address,
                "breakdown": {
                    "fixed": calc["fixed"],
                    "cpm": calc["cpm"],
                    "per_post": calc["per_post"],
                    "milestones": calc["milestones"],
                },
                "_participation": part,
                "_campaign": campaign,
                "_calc": calc,
            })
    rows.sort(key=lambda r: r["amount_owed"], reverse=True)
    return rows


def compute_owed_for_creator(db: Session, creator_id: uuid.UUID) -> list[dict]:
    return [r for r in compute_owed_all(db) if r["creator_id"] == str(creator_id)]


# ── wallet ───────────────────────────────────────────────────────────────────

def wallet_get(db: Session, admin_id: Optional[uuid.UUID] = None, for_update: bool = False) -> Wallet:
    """System-wide wallet (admin_id IS NULL) — seeded by migration 0016.
    `admin_id` is accepted for future per-admin wallets but MVP uses the
    single system wallet regardless of caller.

    `for_update=True` takes a row lock (SELECT ... FOR UPDATE) — the pay paths
    use it so concurrent Pay-All/Pay-One calls serialize on this one row. That
    single lock is what prevents (a) the same owed amount being paid twice by
    racing requests, and (b) lost-update on the balance decrement, because the
    second txn blocks until the first commits and then recomputes owed against
    the now-committed Payout rows."""
    stmt = select(Wallet).where(Wallet.admin_id.is_(None))
    if for_update:
        stmt = stmt.with_for_update()
    wallet = db.scalar(stmt)
    if wallet is None:
        # Defensive fallback in case the seed row is missing (e.g. tests).
        wallet = Wallet(admin_id=None, available_balance=_ZERO, pending_balance=_ZERO, currency="USD")
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return wallet


def wallet_add_funds(
    db: Session, admin_id: uuid.UUID, amount: Decimal, reference: Optional[str], note: Optional[str]
) -> Wallet:
    """Mock top-up — no real payment rail. Just increments available_balance
    and records a `deposit` ledger row."""
    amount = _q(amount)
    if amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Amount must be positive")
    wallet = wallet_get(db)
    wallet.available_balance = _q(wallet.available_balance + amount)
    db.add(WalletTransaction(
        wallet_id=wallet.id, kind="deposit", amount=amount,
        reference=(reference or "").strip() or None, note=(note or "").strip() or None,
        admin_id=admin_id,
    ))
    audit.log(db, actor_admin_id=admin_id, action="wallet.add_funds", entity_type="wallet",
              entity_id=wallet.id, amount=str(amount))
    db.commit()
    db.refresh(wallet)
    return wallet


def _undo_txn(balance: Decimal, kind: str, amount) -> Decimal:
    """Reverse one transaction's effect on the wallet balance (walking backward
    from newest). Deposits/refunds credited the wallet; everything else debited."""
    if kind in ("deposit", "refund"):
        return _q(balance - amount)
    return _q(balance + amount)


def wallet_ledger(db: Session, limit: int = 100, offset: int = 0) -> list[dict]:
    wallet = wallet_get(db)
    # Running balance walks backward from the CURRENT balance. On any page past
    # the first, seed by first undoing every transaction newer than this page
    # (the `offset` rows above it) — otherwise balance_after is wrong for offset>0.
    balance = wallet.available_balance
    if offset:
        newer = db.scalars(
            select(WalletTransaction)
            .where(WalletTransaction.wallet_id == wallet.id)
            .order_by(WalletTransaction.created_at.desc())
            .limit(offset)
        ).all()
        for t in newer:
            balance = _undo_txn(balance, t.kind, t.amount)
    txns = db.scalars(
        select(WalletTransaction)
        .where(WalletTransaction.wallet_id == wallet.id)
        .order_by(WalletTransaction.created_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    out = []
    for t in txns:
        balance_after = balance
        balance = _undo_txn(balance, t.kind, t.amount)
        out.append({
            "id": str(t.id),
            "kind": t.kind,
            "amount": t.amount,
            "reference": t.reference,
            "note": t.note,
            "created_at": t.created_at,
            "payout_id": str(t.payout_id) if t.payout_id else None,
            "balance_after": balance_after,
        })
    return out


# ── pay all / pay one ────────────────────────────────────────────────────────

def _resolve_method(method: Optional[str]) -> str:
    """Payout.method is a native enum restricted to paypal|solana|whop — fall
    back to 'whop' when the creator hasn't set a preferred method yet."""
    if method in ("paypal", "solana", "whop"):
        return method
    return "whop"


def _pay_creator_rows(db: Session, admin_id: uuid.UUID, wallet: Wallet, rows: Iterable[dict],
                      reference: Optional[str] = None) -> list[Payout]:
    """Create one Payout per row (each row = one creator+campaign owed
    amount), deduct from the wallet, mark bonus milestones as awarded, and
    log a `payout` wallet_transaction per payout. Rows with net_owed <= 0 are
    skipped defensively (compute_owed_all already filters these out)."""
    created: list[Payout] = []
    for row in rows:
        amount = _q(row["amount_owed"])
        if amount <= 0:
            continue
        # No wallet-balance gate: there is no real payment rail (the wallet is a
        # mock ledger and the admin-facing top-up UI was removed), so a payout is
        # a record of money owed being settled, not a funded transfer. Gating on
        # a fictional balance would only block legitimate payouts with no in-app
        # way to resolve it. The balance still tracks (can go negative) for the
        # ledger's sake.
        part: CampaignParticipation = row["_participation"]
        campaign: Campaign = row["_campaign"]
        calc = row["_calc"]
        method, address = row.get("payout_method"), row.get("payout_address")

        payout = Payout(
            creator_id=part.creator_id,
            amount=amount,
            method=_resolve_method(method),
            status="paid",
            processed_by=admin_id,
            paid_at=_now(),
            # A caller-supplied receipt/txn reference wins over the payout address;
            # it's the external record of the manual payment the admin just made.
            external_ref=(reference or "").strip() or address or None,
            due_date=campaign.ends_at.date() if campaign.ends_at else None,
            program_name=campaign.name,
            campaign_id=campaign.id,
            awarded_bonus_ids=list(calc["newly_eligible_bonus_ids"]),
        )
        db.add(payout)
        db.flush()

        try:
            with db.begin_nested():
                item_rows = db.execute(
                    select(Submission.id, func.coalesce(Submission.estimated_amount, 0)).where(
                        Submission.creator_id == part.creator_id,
                        Submission.campaign_id == campaign.id,
                        Submission.participation_id == part.id,
                        Submission.verification_status == "verified",
                        Submission.is_suspicious.is_(False),
                        Submission.id.not_in(
                            select(PayoutItem.submission_id).where(PayoutItem.voided_at.is_(None))
                        ),
                    )
                ).all()
                for submission_id, estimated_amount in item_rows:
                    item_amount = _q(estimated_amount)
                    if item_amount > 0:
                        db.add(PayoutItem(
                            payout_id=payout.id,
                            submission_id=submission_id,
                            amount=item_amount,
                        ))
                db.flush()
        except Exception:
            pass

        # Mark milestones as awarded on the participation so a re-run of
        # Pay All never double-pays the same bonus.
        if calc["newly_eligible_bonus_ids"]:
            existing = list(part.payout_awarded_bonus_ids or [])
            part.payout_awarded_bonus_ids = existing + list(calc["newly_eligible_bonus_ids"])

        wallet.available_balance = _q(wallet.available_balance - amount)
        # Track real per-campaign spend so the Forecast's avg_daily_burn reflects
        # money actually paid (spent_amount was previously never written → burn $0).
        campaign.spent_amount = _q((campaign.spent_amount or _ZERO) + amount)
        db.add(WalletTransaction(
            wallet_id=wallet.id, kind="payout", amount=amount,
            reference=campaign.name, payout_id=payout.id, admin_id=admin_id,
            note=f"Payout to creator {part.creator_id}",
        ))
        audit.log(db, actor_admin_id=admin_id, action="payout.pay_all", entity_type="payout",
                  entity_id=payout.id, creator_id=str(part.creator_id), amount=str(amount),
                  campaign_id=str(campaign.id))
        created.append(payout)
    return created


def pay_all(db: Session, admin_id: uuid.UUID, creator_ids: Optional[list[str]] = None) -> dict:
    # Lock the wallet row FIRST, then compute owed — this serializes concurrent
    # pay calls so a racing request recomputes owed only after the prior payout
    # has committed (net_owed then drops to 0 → no double-pay).
    wallet = wallet_get(db, for_update=True)
    rows = compute_owed_all(db)
    if creator_ids:
        wanted = set(creator_ids)
        rows = [r for r in rows if r["creator_id"] in wanted]

    created = _pay_creator_rows(db, admin_id, wallet, rows)
    db.commit()
    for p in created:
        db.refresh(p)
    total = sum((p.amount for p in created), _ZERO)
    return {"paid_count": len(created), "total_amount": total, "payouts": created}


def pay_one(db: Session, admin_id: uuid.UUID, creator_id: uuid.UUID,
            reference: Optional[str] = None) -> Payout:
    # Lock the wallet row before computing owed (see pay_all) so two concurrent
    # Pay-One clicks on the same creator can't both create a payout.
    wallet = wallet_get(db, for_update=True)
    rows = compute_owed_for_creator(db, creator_id)
    if not rows:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No payable owed amount for this creator")
    created = _pay_creator_rows(db, admin_id, wallet, rows, reference=reference)
    if not created:
        # Reachable only if the owed rows netted to <= 0 between compute and pay
        # (e.g. a racing request just paid them) — no funds gate exists anymore.
        raise HTTPException(status.HTTP_409_CONFLICT, "This creator's owed amount was already paid")
    db.commit()
    for p in created:
        db.refresh(p)
    # Return the largest single payout created (usually just one row/campaign;
    # if multiple campaigns owed, the caller can fetch full history for the rest).
    return max(created, key=lambda p: p.amount)


def void_payout(db: Session, admin_id: uuid.UUID, payout_id: uuid.UUID) -> Payout:
    """Reverse a paid payout: free its PayoutItems (so the work becomes owed and
    re-payable again via uq_active_payout_item), credit the wallet back with a
    `refund` ledger row, roll back the campaign's tracked spend, and mark the
    Payout `failed` (the enum has no `voided` value; `failed` excludes it from
    `_already_paid_for_participation` so the amount reappears as owed)."""
    payout = db.get(Payout, payout_id)
    if payout is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payout not found")
    if payout.status != "paid":
        raise HTTPException(status.HTTP_409_CONFLICT, "Only a paid payout can be voided")

    wallet = wallet_get(db, for_update=True)
    now = _now()
    items = db.scalars(
        select(PayoutItem).where(PayoutItem.payout_id == payout.id, PayoutItem.voided_at.is_(None))
    ).all()
    for it in items:
        it.voided_at = now

    amount = _q(payout.amount)
    # Only credit the wallet back if this payout actually DEBITED it. The v2
    # engine writes a kind='payout' WalletTransaction; legacy manual/record
    # payouts (payouts.py) never touch the wallet, so refunding one would credit
    # money that was never taken out and permanently inflate the balance.
    debited = db.scalar(
        select(WalletTransaction.id).where(
            WalletTransaction.payout_id == payout.id, WalletTransaction.kind == "payout")
    ) is not None
    if debited:
        wallet.available_balance = _q(wallet.available_balance + amount)
        db.add(WalletTransaction(
            wallet_id=wallet.id, kind="refund", amount=amount,
            reference=payout.program_name, payout_id=payout.id, admin_id=admin_id,
            note=f"Void/refund of payout to creator {payout.creator_id}",
        ))
    if payout.campaign_id:
        campaign = db.get(Campaign, payout.campaign_id)
        if campaign is not None:
            campaign.spent_amount = _q(max(_ZERO, (campaign.spent_amount or _ZERO) - amount))
    payout.status = "failed"
    audit.log(db, actor_admin_id=admin_id, action="payout.void", entity_type="payout",
              entity_id=payout.id, creator_id=str(payout.creator_id), amount=str(amount))
    db.commit()
    db.refresh(payout)
    return payout


# ── forecast ─────────────────────────────────────────────────────────────────

def forecast_all(db: Session) -> list[dict]:
    """For each active campaign, project remaining spend from current burn
    rate: projected_amount = sum of current net_owed across its creators;
    avg_daily_burn = spent_amount / days elapsed since publish;
    days_remaining = days until ends_at (if set)."""
    out: list[dict] = []
    campaigns = db.scalars(select(Campaign).where(Campaign.status == "active")).all()
    owed_rows = compute_owed_all(db)

    now = _now()
    for campaign in campaigns:
        campaign_rows = [r for r in owed_rows if r["campaign_id"] == str(campaign.id)]
        projected = sum((r["amount_owed"] for r in campaign_rows), _ZERO)
        active_creators = len({r["creator_id"] for r in campaign_rows})
        total_views = sum((r["total_views"] for r in campaign_rows), 0)

        spent = Decimal(campaign.spent_amount or 0)
        published_at = campaign.published_at or campaign.created_at
        days_elapsed = max((now - published_at).days, 1) if published_at else 1
        avg_daily_burn = _q(spent / Decimal(days_elapsed)) if spent else _q(projected / Decimal(days_elapsed))

        days_remaining = None
        if campaign.ends_at:
            days_remaining = max((campaign.ends_at - now).days, 0)

        out.append({
            "campaign_id": str(campaign.id),
            "campaign_name": campaign.name,
            "projected_amount": _q(projected),
            "active_creators": active_creators,
            "total_views": total_views,
            "avg_daily_burn": avg_daily_burn,
            "days_remaining": days_remaining,
        })
    out.sort(key=lambda r: r["projected_amount"], reverse=True)
    return out


# ── reports ──────────────────────────────────────────────────────────────────

def _payouts_in_range(db: Session, date_from=None, date_to=None, limit: int = 5000):
    # Only real (status='paid') payouts count in reports — a voided payout is
    # status='failed' and must not appear as spend.
    stmt = select(Payout).where(Payout.status == "paid")
    if date_from is not None:
        stmt = stmt.where(Payout.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(Payout.created_at <= date_to)
    return db.scalars(stmt.order_by(Payout.created_at.desc()).limit(limit)).all()


def spending_summary(db: Session, date_from=None, date_to=None) -> dict:
    """Total spend + payout count in a date range — powers the Agency Spending
    Report preview. SQL aggregates so it's correct at any volume."""
    # Exclude voided/failed payouts — only real spend counts.
    stmt = select(func.coalesce(func.sum(Payout.amount), 0), func.count(Payout.id)).where(
        Payout.status == "paid")
    if date_from is not None:
        stmt = stmt.where(Payout.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(Payout.created_at <= date_to)
    total, count = db.execute(stmt).one()
    return {"total": Decimal(total), "count": int(count)}


def payout_report_rows(db: Session, limit: int = 1000, date_from=None, date_to=None):
    """Rows for the reports.csv export: creator, amount, campaign, paid_at,
    method, external_ref. Optionally bounded to a [date_from, date_to] range."""
    profiles = {p.creator_id: p for p in db.scalars(select(CreatorProfile)).all()}
    campaigns = {c.id: c for c in db.scalars(select(Campaign)).all()}
    payouts = _payouts_in_range(db, date_from, date_to, limit=limit)
    for p in payouts:
        prof = profiles.get(p.creator_id)
        campaign = campaigns.get(p.campaign_id) if p.campaign_id else None
        yield {
            "creator": prof.display_name if prof else str(p.creator_id),
            "amount": p.amount,
            "campaign": campaign.name if campaign else (p.program_name or ""),
            "campaign_id": str(p.campaign_id) if p.campaign_id else "",
            "paid_at": p.paid_at.isoformat() if p.paid_at else "",
            "method": p.method,
            "external_ref": p.external_ref or "",
        }
