"""Admin Applicant Review Pipeline (Feature 1 — BUILD_SPEC.md §3.1, Rhys's #1 ask).

SideShift-style triage: New -> Reviewed -> Messaged -> Declined / Bookmarked -> Accepted.
Reuses CampaignParticipation as the "application" record (extended enum + timeline
timestamps + admin_note) rather than introducing a parallel model — the join already
carries campaign_id + creator_id + status, which is exactly SideShift's applicant record.
"""
from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status as http_status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_admin
from app.db.session import get_db
from app.integrations import storage
from app.models import (
    Admin,
    AuditLog,
    Campaign,
    CampaignParticipation,
    Creator,
    CreatorProfile,
    SocialAccount,
    Submission,
)
from app.models.messaging import Message
from app.schemas.admin_applicants import (
    ApplicantCounts,
    ApplicantDetail,
    ApplicantListItem,
    ApplicantSocial,
    ApplicantUpdateIn,
    ApplicantVideo,
    OpenChatOut,
    PendingCampaignItem,
)
from app.services import messaging as messaging_svc

router = APIRouter(prefix="/applicants", tags=["admin-applicants"])

# Statuses that map onto the SideShift pipeline tabs. `joined` (never touched by an
# admin yet) reads as "New" in the UI; the raw enum keeps its DB name.
NEW_STATUSES = ("joined", "submitted", "approved", "rejected")
TAB_STATUS = {
    "new": NEW_STATUSES,
    "reviewed": ("reviewed",),
    "messaged": ("messaged",),
    "declined": ("declined",),
    "bookmarked": ("bookmarked",),
    "accepted": ("accepted",),
}
TIMESTAMP_COLUMN = {
    "reviewed": "reviewed_at",
    "messaged": "messaged_at",
    "declined": "declined_at",
    "bookmarked": "bookmarked_at",
    "accepted": "accepted_at",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _age(dob) -> Optional[int]:
    if not dob:
        return None
    today = datetime.now(timezone.utc).date()
    years = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return years


def _avatar_url(db: Session, avatar_object_id) -> Optional[str]:
    if not avatar_object_id:
        return None
    from app.models import StorageObject

    obj = db.get(StorageObject, avatar_object_id)
    return storage.object_public_url(obj.object_key) if obj else None


def _base_query(campaign_id: Optional[uuid.UUID], status_filter: Optional[str], search: Optional[str]):
    stmt = (
        select(CampaignParticipation, Campaign, Creator, CreatorProfile)
        .join(Campaign, Campaign.id == CampaignParticipation.campaign_id)
        .join(Creator, Creator.id == CampaignParticipation.creator_id)
        .outerjoin(CreatorProfile, CreatorProfile.creator_id == Creator.id)
    )
    if campaign_id:
        stmt = stmt.where(CampaignParticipation.campaign_id == campaign_id)
    if status_filter:
        statuses = TAB_STATUS.get(status_filter, (status_filter,))
        stmt = stmt.where(CampaignParticipation.status.in_(statuses))
    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                CreatorProfile.display_name.ilike(s),
                func.split_part(Creator.email, "@", 1).ilike(s),
            )
        )
    return stmt


def _submission_agg(db: Session, participation_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict]:
    """Batch aggregate views/earnings per participation (avoids N+1)."""
    if not participation_ids:
        return {}
    rows = db.execute(
        select(
            Submission.participation_id,
            func.coalesce(func.sum(Submission.views), 0),
            func.coalesce(func.sum(Submission.estimated_amount), 0),
            func.count(Submission.id),
        )
        .where(Submission.participation_id.in_(participation_ids))
        .group_by(Submission.participation_id)
    ).all()
    return {pid: {"views": int(v), "earnings": Decimal(e), "posts": int(c)} for pid, v, e, c in rows}


def _recent_videos(db: Session, participation_ids: list[uuid.UUID], limit: int) -> dict[uuid.UUID, list[ApplicantVideo]]:
    if not participation_ids:
        return {}
    subs = db.scalars(
        select(Submission)
        .where(Submission.participation_id.in_(participation_ids))
        .order_by(Submission.created_at.desc())
    ).all()
    out: dict[uuid.UUID, list[ApplicantVideo]] = {pid: [] for pid in participation_ids}
    for s in subs:
        bucket = out.setdefault(s.participation_id, [])
        if len(bucket) >= limit:
            continue
        bucket.append(
            ApplicantVideo(
                id=str(s.id),
                thumbnail_url=s.thumbnail_url,
                post_url=s.post_url,
                platform=s.platform,
                views=s.views,
                likes=s.likes,
                comments=s.comments,
                shares=0,  # not tracked yet — Apify updater extension, see BUILD_SPEC §3.1
            )
        )
    return out


def _socials(db: Session, creator_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[SocialAccount]]:
    if not creator_ids:
        return {}
    out: dict[uuid.UUID, list[SocialAccount]] = {cid: [] for cid in creator_ids}
    for s in db.scalars(select(SocialAccount).where(SocialAccount.creator_id.in_(creator_ids))).all():
        out[s.creator_id].append(s)
    return out


def _platforms_for(socials: list[SocialAccount]) -> list[str]:
    return sorted({s.platform for s in socials})


@router.get("", response_model=list[ApplicantListItem])
def list_applicants(
    campaign_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    stmt = _base_query(campaign_id, status, search)
    stmt = stmt.order_by(CampaignParticipation.joined_at.desc()).limit(min(limit, 200)).offset(offset)
    rows = db.execute(stmt).all()

    pids = [p.id for p, _, _, _ in rows]
    creator_ids = [c.id for _, _, c, _ in rows]
    agg = _submission_agg(db, pids)
    videos = _recent_videos(db, pids, limit=4)
    socials_by_creator = _socials(db, creator_ids)

    out: list[ApplicantListItem] = []
    for part, camp, creator, prof in rows:
        socials = socials_by_creator.get(creator.id, [])
        a = agg.get(part.id, {"views": 0, "earnings": Decimal("0"), "posts": 0})
        out.append(
            ApplicantListItem(
                id=str(part.id),
                campaign_id=str(camp.id),
                campaign_name=camp.name,
                creator_id=str(creator.id),
                display_name=prof.display_name if prof else None,
                avatar_url=_avatar_url(db, prof.avatar_object_id if prof else None),
                country=prof.country if prof else None,
                gender=prof.gender if prof else None,
                city=prof.city if prof else None,
                age=_age(prof.date_of_birth) if prof else None,
                status=part.status,
                platforms=_platforms_for(socials),
                recent_videos=videos.get(part.id, []),
                views=a["views"],
                earnings=a["earnings"],
                applied_at=part.joined_at,
                admin_note=part.admin_note,
            )
        )
    return out


@router.get("/counts", response_model=ApplicantCounts)
def counts(
    campaign_id: Optional[uuid.UUID] = None,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    stmt = select(CampaignParticipation.status, func.count(CampaignParticipation.id))
    if campaign_id:
        stmt = stmt.where(CampaignParticipation.campaign_id == campaign_id)
    stmt = stmt.group_by(CampaignParticipation.status)
    raw = dict(db.execute(stmt).all())

    new_count = sum(raw.get(s, 0) for s in NEW_STATUSES)
    return ApplicantCounts(
        new=new_count,
        reviewed=raw.get("reviewed", 0),
        messaged=raw.get("messaged", 0),
        declined=raw.get("declined", 0),
        bookmarked=raw.get("bookmarked", 0),
        accepted=raw.get("accepted", 0),
        submitted=raw.get("submitted", 0),
        approved=raw.get("approved", 0),
        rejected=raw.get("rejected", 0),
    )


@router.get("/export.csv")
def export_csv(
    campaign_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    stmt = _base_query(campaign_id, status, None).order_by(CampaignParticipation.joined_at.desc())
    rows = db.execute(stmt).all()
    pids = [p.id for p, _, _, _ in rows]
    agg = _submission_agg(db, pids)

    def _rows():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "participation_id", "campaign", "creator_email", "display_name", "status",
            "country", "city", "gender", "views", "earnings", "posts", "applied_at",
        ])
        yield buf.getvalue()
        buf.seek(0); buf.truncate(0)
        for part, camp, creator, prof in rows:
            a = agg.get(part.id, {"views": 0, "earnings": Decimal("0"), "posts": 0})
            writer.writerow([
                str(part.id), camp.name, creator.email,
                prof.display_name if prof else "", part.status,
                prof.country if prof else "", prof.city if prof else "",
                prof.gender if prof else "", a["views"], a["earnings"], a["posts"],
                part.joined_at.isoformat(),
            ])
            yield buf.getvalue()
            buf.seek(0); buf.truncate(0)

    return StreamingResponse(
        _rows(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=applicants.csv"},
    )


@router.get("/{participation_id}", response_model=ApplicantDetail)
def applicant_detail(
    participation_id: uuid.UUID,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    row = db.execute(
        select(CampaignParticipation, Campaign, Creator, CreatorProfile)
        .join(Campaign, Campaign.id == CampaignParticipation.campaign_id)
        .join(Creator, Creator.id == CampaignParticipation.creator_id)
        .outerjoin(CreatorProfile, CreatorProfile.creator_id == Creator.id)
        .where(CampaignParticipation.id == participation_id)
    ).first()
    if row is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Applicant not found")
    part, camp, creator, prof = row

    agg = _submission_agg(db, [part.id]).get(part.id, {"views": 0, "earnings": Decimal("0"), "posts": 0})
    videos = _recent_videos(db, [part.id], limit=8).get(part.id, [])
    socials = _socials(db, [creator.id]).get(creator.id, [])

    return ApplicantDetail(
        id=str(part.id),
        campaign_id=str(camp.id),
        campaign_name=camp.name,
        creator_id=str(creator.id),
        email=creator.email,
        display_name=prof.display_name if prof else None,
        avatar_url=_avatar_url(db, prof.avatar_object_id if prof else None),
        bio=prof.bio if prof else None,
        country=prof.country if prof else None,
        city=prof.city if prof else None,
        gender=prof.gender if prof else None,
        age=_age(prof.date_of_birth) if prof else None,
        primary_language=prof.primary_language if prof else None,
        education=None,  # not modeled yet — SideShift shows this from a free-text field
        status=part.status,
        views=agg["views"],
        earnings=agg["earnings"],
        posts=agg["posts"],
        streak_days=0,  # gamification layer lands in a later feature (backlog #7)
        socials=[
            ApplicantSocial(
                platform=s.platform, handle=s.handle, profile_url=s.profile_url,
                follower_count=s.follower_count,
            )
            for s in socials
        ],
        recent_videos=videos,
        niches=[],  # niches taxonomy lands with gamification layer (backlog #7)
        admin_note=part.admin_note,
        applied_at=part.joined_at,
        reviewed_at=part.reviewed_at,
        messaged_at=part.messaged_at,
        bookmarked_at=part.bookmarked_at,
        declined_at=part.declined_at,
        accepted_at=part.accepted_at,
    )


@router.patch("/{participation_id}", response_model=ApplicantDetail)
def update_applicant(
    participation_id: uuid.UUID,
    body: ApplicantUpdateIn,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    part = db.get(CampaignParticipation, participation_id)
    if part is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Applicant not found")

    changes: dict = {}
    if body.status is not None and body.status != part.status:
        old_status = part.status
        part.status = body.status
        ts_col = TIMESTAMP_COLUMN.get(body.status)
        if ts_col:
            setattr(part, ts_col, _now())
        # Declining must revoke the accepted gate. The creator-accepted check is
        # `accepted_at IS NOT NULL AND removed_at IS NULL`, so leaving accepted_at
        # set after a decline let a declined (previously-accepted) creator keep
        # submit access. Clear it on decline; re-accepting sets it again above.
        if body.status == "declined":
            part.accepted_at = None
        changes["status"] = {"from": old_status, "to": body.status}
    if body.admin_note is not None:
        changes["admin_note"] = {"from": part.admin_note, "to": body.admin_note}
        part.admin_note = body.admin_note

    if changes:
        db.add(AuditLog(
            actor_admin_id=admin.id,
            action="applicant.update",
            entity_type="campaign_participation",
            entity_id=part.id,
            metadata_=changes,
        ))
    db.commit()
    return applicant_detail(participation_id, admin=admin, db=db)


def _first_name(name: Optional[str]) -> str:
    return (name or "").strip().split(" ")[0] or "there"


@router.post("/{participation_id}/message", response_model=OpenChatOut)
def open_applicant_chat(
    participation_id: uuid.UUID,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Open (or reuse) the DM with this applicant and, if the thread is empty,
    send a warm first message on the admin's behalf — so "Message" never dumps
    the admin into a blank thread. Also moves the applicant into the Messaged
    pipeline stage. Returns the conversation id so the UI can open that thread."""
    row = db.execute(
        select(CampaignParticipation, Campaign, CreatorProfile)
        .join(Campaign, Campaign.id == CampaignParticipation.campaign_id)
        .outerjoin(CreatorProfile, CreatorProfile.creator_id == CampaignParticipation.creator_id)
        .where(CampaignParticipation.id == participation_id)
    ).first()
    if row is None:
        raise HTTPException(http_status.HTTP_404_NOT_FOUND, "Applicant not found")
    part, camp, prof = row

    conv = messaging_svc.get_or_create_for_creator(db, part.creator_id)
    has_messages = db.scalar(
        select(func.count(Message.id)).where(Message.conversation_id == conv.id)
    )
    if not has_messages:
        first = _first_name(prof.display_name if prof else None)
        body = (
            f"Hey {first}! Love your profile — you could be a great fit for "
            f"\"{camp.name}\".\n\n"
            "We'd really like to work with you, and I'm happy to share examples "
            "of similar work we've done for other brands.\n\n"
            "To kick things off: what brands have you created content for so far, "
            "and what kind of content do you usually make? Tell me a bit and we'll "
            "take it from there \U0001F64C"
        )
        messaging_svc.send_message(db, conv.id, sender_type="admin", body=body, sender_admin_id=admin.id)

    # Advance the pipeline stage (mirrors the old "Message" button behaviour).
    if part.status != "messaged" and part.messaged_at is None:
        part.status = "messaged"
        part.messaged_at = _now()
        db.commit()

    return OpenChatOut(conversation_id=str(conv.id))


@router.get("/by-creator/{creator_id}/pending", response_model=list[PendingCampaignItem])
def creator_pending_campaigns(
    creator_id: uuid.UUID,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Campaigns this creator has applied to but hasn't been accepted into yet
    (and isn't declined/removed from) — so the admin can approve or decline them
    straight from the message thread, no need to hunt through the Applicants tab."""
    rows = db.execute(
        select(CampaignParticipation, Campaign)
        .join(Campaign, Campaign.id == CampaignParticipation.campaign_id)
        .where(
            CampaignParticipation.creator_id == creator_id,
            CampaignParticipation.accepted_at.is_(None),
            CampaignParticipation.declined_at.is_(None),
            CampaignParticipation.removed_at.is_(None),
        )
        .order_by(CampaignParticipation.joined_at.desc())
    ).all()
    return [
        PendingCampaignItem(
            participation_id=str(part.id), campaign_id=str(camp.id),
            campaign_name=camp.name, status=part.status,
        )
        for part, camp in rows
    ]
