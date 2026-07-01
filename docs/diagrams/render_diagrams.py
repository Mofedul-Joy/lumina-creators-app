#!/usr/bin/env python3
"""Render architecture diagrams for the Lumina Creators App docs."""

from __future__ import annotations

from pathlib import Path
from textwrap import wrap

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch


OUT_DIR = Path(__file__).resolve().parent

TEXT = "#111827"
MUTED = "#52525B"
GREEN = "#16351F"
ACCENT = "#22C55E"
FILL = "#F4F4F5"
LINE = "#A1A1AA"
RED = "#B91C1C"
RED_SOFT = "#FEE2E2"
WHITE = "#FFFFFF"


def setup_canvas(width: float = 14, height: float = 9):
    plt.rcParams.update(
        {
            "font.family": "DejaVu Sans",
            "font.size": 9,
            "figure.facecolor": WHITE,
            "axes.facecolor": WHITE,
            "savefig.facecolor": WHITE,
        }
    )
    fig, ax = plt.subplots(figsize=(width, height), dpi=96)
    ax.set_xlim(0, width)
    ax.set_ylim(0, height)
    ax.axis("off")
    return fig, ax


def rounded_box(
    ax,
    x,
    y,
    w,
    h,
    text,
    *,
    fc=FILL,
    ec=LINE,
    lw=1.2,
    color=TEXT,
    fontsize=9,
    weight="normal",
    radius=0.12,
    ha="center",
    va="center",
    z=2,
    pad=0.025,
):
    box = FancyBboxPatch(
        (x, y),
        w,
        h,
        boxstyle=f"round,pad={pad},rounding_size={radius}",
        linewidth=lw,
        edgecolor=ec,
        facecolor=fc,
        zorder=z,
    )
    ax.add_patch(box)
    ax.text(
        x + w / 2,
        y + h / 2,
        text,
        ha=ha,
        va=va,
        color=color,
        fontsize=fontsize,
        fontweight=weight,
        zorder=z + 1,
        linespacing=1.22,
    )
    return box


def group_box(ax, x, y, w, h, title, *, subtitle=None):
    rounded_box(ax, x, y, w, h, "", fc=WHITE, ec=GREEN, lw=1.7, radius=0.18, z=1)
    ax.add_patch(
        FancyBboxPatch(
            (x, y + h - 0.48),
            w,
            0.48,
            boxstyle="round,pad=0.025,rounding_size=0.18",
            linewidth=0,
            facecolor=GREEN,
            zorder=2,
        )
    )
    ax.text(
        x + 0.25,
        y + h - 0.24,
        title,
        ha="left",
        va="center",
        color=WHITE,
        fontsize=10,
        fontweight="bold",
        zorder=3,
    )
    if subtitle:
        ax.text(
            x + w - 0.25,
            y + h - 0.24,
            subtitle,
            ha="right",
            va="center",
            color="#D1FAE5",
            fontsize=7.5,
            zorder=3,
        )


def arrow(
    ax,
    start,
    end,
    *,
    text=None,
    color=ACCENT,
    lw=1.8,
    rad=0.0,
    ms=12,
    linestyle="-",
    text_offset=(0, 0),
    fontsize=8,
    z=5,
):
    patch = FancyArrowPatch(
        start,
        end,
        arrowstyle="-|>",
        mutation_scale=ms,
        linewidth=lw,
        color=color,
        linestyle=linestyle,
        shrinkA=5,
        shrinkB=5,
        connectionstyle=f"arc3,rad={rad}",
        zorder=z,
    )
    ax.add_patch(patch)
    if text:
        mx = (start[0] + end[0]) / 2 + text_offset[0]
        my = (start[1] + end[1]) / 2 + text_offset[1]
        ax.text(
            mx,
            my,
            text,
            ha="center",
            va="center",
            fontsize=fontsize,
            color=color,
            fontweight="bold",
            bbox={"boxstyle": "round,pad=0.18", "fc": WHITE, "ec": "none"},
            zorder=z + 1,
        )
    return patch


def line(
    ax,
    start,
    end,
    *,
    color=LINE,
    lw=1.25,
    linestyle="-",
    label=None,
    label_pos=0.5,
    label_offset=(0, 0),
    z=3,
):
    patch = FancyArrowPatch(
        start,
        end,
        arrowstyle="-",
        linewidth=lw,
        color=color,
        linestyle=linestyle,
        shrinkA=3,
        shrinkB=3,
        zorder=z,
    )
    ax.add_patch(patch)
    if label:
        lx = start[0] + (end[0] - start[0]) * label_pos + label_offset[0]
        ly = start[1] + (end[1] - start[1]) * label_pos + label_offset[1]
        ax.text(
            lx,
            ly,
            label,
            ha="center",
            va="center",
            fontsize=7.2,
            color=TEXT,
            fontweight="bold",
            bbox={"boxstyle": "round,pad=0.12", "fc": WHITE, "ec": "none"},
            zorder=z + 1,
        )


def title(ax, text, subtitle=None, *, width=14, y=8.68):
    ax.text(
        width / 2,
        y,
        text,
        ha="center",
        va="center",
        fontsize=17,
        fontweight="bold",
        color=GREEN,
    )
    if subtitle:
        ax.text(width / 2, y - 0.33, subtitle, ha="center", va="center", fontsize=9, color=MUTED)


def render_architecture():
    fig, ax = setup_canvas(14, 9)
    title(ax, "Lumina Creators App", "System architecture and deployment", width=14)

    rounded_box(
        ax,
        4.7,
        7.82,
        4.6,
        0.42,
        "GitHub  ->  autodeploy  ->  Vercel + Render",
        fc="#ECFDF5",
        ec=ACCENT,
        color=GREEN,
        fontsize=8.4,
        weight="bold",
    )

    rounded_box(ax, 0.45, 6.78, 2.4, 0.68, "Creator\n(web/mobile browser)", fc=FILL, ec=GREEN, weight="bold")
    rounded_box(ax, 0.45, 5.87, 2.4, 0.68, "Admin\n(Lumina staff)", fc=FILL, ec=GREEN, weight="bold")

    group_box(ax, 3.25, 5.45, 7.9, 1.75, "Vercel layer", subtitle="Frontend")
    rounded_box(ax, 3.65, 6.15, 1.95, 0.56, "(creator) app", ec=GREEN, weight="bold")
    rounded_box(ax, 5.95, 6.15, 1.95, 0.56, "(admin) app", ec=GREEN, weight="bold")
    rounded_box(ax, 8.25, 6.15, 2.35, 0.56, "lib/api.ts\ntyped client", ec=GREEN, weight="bold", fontsize=8.3)
    ax.text(7.2, 5.82, "Next.js 15 (App Router)", ha="center", va="center", color=GREEN, fontsize=12, fontweight="bold")

    group_box(ax, 3.25, 3.02, 7.9, 1.85, "Render layer", subtitle="Backend")
    rounded_box(ax, 3.58, 3.91, 2.35, 0.56, "routers: creator / admin /\npublic (health-only)", ec=GREEN, fontsize=7.9)
    rounded_box(ax, 6.18, 3.91, 1.55, 0.56, "services", ec=GREEN, weight="bold")
    rounded_box(ax, 7.98, 3.91, 2.62, 0.56, "scrape worker\n(Render cron)", ec=GREEN, weight="bold", fontsize=8.2)
    ax.text(7.2, 3.48, "FastAPI", ha="center", va="center", color=GREEN, fontsize=12, fontweight="bold")

    rounded_box(ax, 5.35, 1.28, 3.7, 0.86, "PostgreSQL\n(Render)", fc=FILL, ec=GREEN, fontsize=10, weight="bold")

    group_box(ax, 11.65, 2.78, 1.95, 3.7, "External services")
    rounded_box(ax, 11.9, 5.6, 1.45, 0.45, "Apify\n(view scraping)", ec=GREEN, fontsize=7.4)
    rounded_box(ax, 11.9, 4.67, 1.45, 0.45, "Cloudflare R2\n(uploads)", ec=GREEN, fontsize=7.4)
    rounded_box(ax, 11.9, 3.42, 1.45, 0.63, "PayPal / Solana /\nWhop (payouts)", ec=GREEN, fontsize=7.2)

    arrow(ax, (2.85, 7.05), (3.23, 6.72), fontsize=7.4)
    arrow(ax, (2.85, 6.05), (3.23, 6.18), text="HTTPS", text_offset=(0.02, 0.30), fontsize=7.2)
    arrow(ax, (7.2, 5.45), (7.2, 4.87), text="Bearer JWT", text_offset=(0.75, 0), fontsize=7.4)
    arrow(ax, (7.2, 3.02), (7.2, 2.14), text="SQLAlchemy", text_offset=(0.8, 0), fontsize=7.2)
    arrow(ax, (9.3, 4.18), (11.9, 5.82), text="Apify runs", text_offset=(0.0, 0.18), fontsize=7.2)
    arrow(ax, (10.95, 3.95), (11.9, 4.9), text="presigned\nuploads", text_offset=(-0.18, 0.1), fontsize=6.8)
    arrow(ax, (10.95, 3.55), (11.9, 3.73), text="transfers", text_offset=(-0.08, -0.14), fontsize=7.2)
    arrow(ax, (5.5, 7.82), (5.5, 7.2), text="Vercel", color=GREEN, text_offset=(-0.55, 0.02), fontsize=7)
    arrow(ax, (8.08, 7.82), (8.08, 4.87), text="Render", color=GREEN, rad=-0.05, text_offset=(0.5, -1.12), fontsize=7)

    ax.text(7, 0.38, "Closed marketplace: creator and admin audiences are separated at the router/auth layer.", ha="center", color=MUTED, fontsize=8)
    fig.tight_layout(pad=0.25)
    fig.savefig(OUT_DIR / "01_architecture.png", dpi=96)
    plt.close(fig)


def table_box(ax, x, y, w, h, name, columns):
    rounded_box(ax, x, y, w, h, "", fc=FILL, ec=GREEN, lw=1.15, radius=0.1, z=2)
    ax.add_patch(
        FancyBboxPatch(
            (x, y + h - 0.32),
            w,
            0.32,
            boxstyle="round,pad=0.018,rounding_size=0.1",
            linewidth=0,
            facecolor=GREEN,
            zorder=3,
        )
    )
    ax.text(x + 0.12, y + h - 0.16, name, ha="left", va="center", color=WHITE, fontsize=8.2, fontweight="bold", zorder=4)
    body = "\n".join(columns)
    ax.text(x + 0.14, y + h - 0.47, body, ha="left", va="top", color=TEXT, fontsize=6.7, linespacing=1.16, zorder=4)


def edge_mid(box, side):
    x, y, w, h = box
    if side == "left":
        return (x, y + h / 2)
    if side == "right":
        return (x + w, y + h / 2)
    if side == "top":
        return (x + w / 2, y + h)
    if side == "bottom":
        return (x + w / 2, y)
    raise ValueError(side)


def cardinality(ax, start, end, left_label, right_label, *, label=None, color=LINE, linestyle="-", offset=(0, 0)):
    line(ax, start, end, color=color, lw=1.15, linestyle=linestyle, label=label, label_offset=offset)
    sx, sy = start
    ex, ey = end
    ax.text(sx, sy, left_label, ha="center", va="center", fontsize=7.3, color=GREEN, fontweight="bold", bbox={"fc": WHITE, "ec": "none", "pad": 0.3}, zorder=6)
    ax.text(ex, ey, right_label, ha="center", va="center", fontsize=7.3, color=GREEN, fontweight="bold", bbox={"fc": WHITE, "ec": "none", "pad": 0.3}, zorder=6)


def render_data_model():
    fig, ax = setup_canvas(16, 10)
    title(ax, "Core Data Model", "Finalized high-priority PostgreSQL schema", width=16, y=9.62)

    boxes = {
        "creators": (0.55, 7.0, 2.35, 1.32),
        "creator_profiles": (3.55, 7.55, 2.65, 1.24),
        "storage_objects": (6.9, 7.45, 2.7, 1.32),
        "admins": (12.55, 7.55, 2.35, 1.16),
        "social_accounts": (0.55, 5.15, 2.35, 1.22),
        "portfolio_items": (3.55, 5.15, 2.65, 1.22),
        "campaigns": (12.2, 5.15, 2.75, 1.42),
        "payment_methods": (0.55, 3.3, 2.35, 1.22),
        "campaign_participations": (7.0, 4.75, 3.15, 1.24),
        "submissions": (7.0, 2.65, 3.15, 1.42),
        "scrape_jobs": (12.25, 2.9, 2.65, 1.18),
        "payouts": (0.55, 1.18, 2.35, 1.26),
        "payout_items": (3.85, 1.18, 2.55, 1.26),
    }

    table_box(ax, *boxes["creators"], "creators", ["PK id", "email (unique)", "password_hash", "status", "signup_source", "email_verified"])
    table_box(ax, *boxes["creator_profiles"], "creator_profiles", ["PK id", "FK creator_id (unique)", "FK avatar_object_id", "display_name", "gender / DOB / geo", "completed_at"])
    table_box(ax, *boxes["storage_objects"], "storage_objects", ["PK id", "FK owner_creator_id", "purpose", "bucket + object_key", "status", "finalized_at"])
    table_box(ax, *boxes["admins"], "admins", ["PK id", "email (unique)", "password_hash", "role", "is_active"])
    table_box(ax, *boxes["social_accounts"], "social_accounts", ["PK id", "FK creator_id", "platform", "handle", "follower_count"])
    table_box(ax, *boxes["portfolio_items"], "portfolio_items", ["PK id", "FK creator_id", "FK storage_object_id", "brand_name", "platform"])
    table_box(ax, *boxes["campaigns"], "campaigns", ["PK id", "FK created_by", "mode / status", "cpm_rate + budget", "platforms", "spent_amount"])
    table_box(ax, *boxes["payment_methods"], "payment_methods", ["PK id", "FK creator_id", "method", "provider fields", "is_default"])
    table_box(ax, *boxes["campaign_participations"], "campaign_participations", ["PK id", "FK campaign_id", "FK creator_id", "status", "joined_at", "UNIQUE campaign+creator"])
    table_box(ax, *boxes["submissions"], "submissions", ["PK id", "FK participation_id", "FK campaign_id / creator_id", "url_hash + platform", "payable_amount", "FK proof_object_id"])
    table_box(ax, *boxes["scrape_jobs"], "scrape_jobs", ["PK id", "FK submission_id (unique)", "status / attempts", "last_apify_run_id", "next_run_at"])
    table_box(ax, *boxes["payouts"], "payouts", ["PK id", "FK creator_id", "amount", "status", "idempotency_key"])
    table_box(ax, *boxes["payout_items"], "payout_items", ["PK id", "FK payout_id", "FK submission_id", "amount", "voided_at"])

    # Identity and profile relationships.
    cardinality(ax, edge_mid(boxes["creators"], "right"), edge_mid(boxes["creator_profiles"], "left"), "1", "1", label="profile")
    cardinality(ax, edge_mid(boxes["creators"], "bottom"), edge_mid(boxes["social_accounts"], "top"), "1", "N", label="socials", offset=(0.18, 0))
    cardinality(ax, (2.9, 5.78), edge_mid(boxes["portfolio_items"], "left"), "1", "N", label="portfolio")
    cardinality(ax, (1.72, 7.0), edge_mid(boxes["payment_methods"], "top"), "1", "N", label="methods", offset=(0.2, 0))

    # Campaign and submission core.
    cardinality(ax, edge_mid(boxes["admins"], "bottom"), edge_mid(boxes["campaigns"], "top"), "1", "N", label="creates", offset=(0.12, 0))
    cardinality(ax, edge_mid(boxes["campaigns"], "left"), edge_mid(boxes["campaign_participations"], "right"), "1", "N", label="entries")
    cardinality(ax, edge_mid(boxes["campaign_participations"], "bottom"), edge_mid(boxes["submissions"], "top"), "1", "N", label="posts")
    cardinality(ax, edge_mid(boxes["submissions"], "right"), edge_mid(boxes["scrape_jobs"], "left"), "1", "1", label="scrape queue")

    # Creator to participation and payout paths, drawn as routed lines to keep the center readable.
    line(ax, edge_mid(boxes["creators"], "right"), (6.7, 5.37), label="1:N joins", label_pos=0.62, color=LINE)
    line(ax, (6.7, 5.37), edge_mid(boxes["campaign_participations"], "left"), color=LINE)
    ax.text(2.92, 7.63, "1", color=GREEN, fontsize=7.3, fontweight="bold", bbox={"fc": WHITE, "ec": "none"})
    ax.text(6.78, 5.42, "N", color=GREEN, fontsize=7.3, fontweight="bold", bbox={"fc": WHITE, "ec": "none"})

    cardinality(ax, edge_mid(boxes["creators"], "bottom"), edge_mid(boxes["payouts"], "top"), "1", "N", label="payouts", offset=(-0.25, 0), color=LINE)
    cardinality(ax, edge_mid(boxes["payouts"], "right"), edge_mid(boxes["payout_items"], "left"), "1", "N", label="items")
    cardinality(
        ax,
        edge_mid(boxes["payout_items"], "right"),
        edge_mid(boxes["submissions"], "left"),
        "N",
        "1",
        label="active-unique",
        color=ACCENT,
        offset=(0.1, 0.26),
    )

    # Storage references are dashed because storage_objects is referenced by columns, not an ownership parent for every row.
    cardinality(ax, edge_mid(boxes["creator_profiles"], "right"), edge_mid(boxes["storage_objects"], "left"), "N", "1", label="avatar", color=ACCENT, linestyle="--")
    cardinality(ax, edge_mid(boxes["portfolio_items"], "right"), (6.9, 7.82), "N", "1", label="video object", color=ACCENT, linestyle="--", offset=(-0.2, 0.18))
    cardinality(ax, (10.15, 3.2), (8.25, 7.45), "N", "1", label="proof", color=ACCENT, linestyle="--", offset=(0.35, 0.08))

    rounded_box(
        ax,
        10.9,
        0.8,
        4.1,
        0.75,
        "Financial invariant: one active payout_item per submission;\nfailed payouts void items to release earnings for retry.",
        fc="#ECFDF5",
        ec=ACCENT,
        color=GREEN,
        fontsize=7.6,
        weight="bold",
    )

    fig.tight_layout(pad=0.25)
    fig.savefig(OUT_DIR / "02_data_model.png", dpi=96)
    plt.close(fig)


def state_box(ax, x, y, w, h, text, *, fc=FILL, ec=GREEN, color=TEXT, weight="bold", fontsize=9):
    wrapped = "\n".join(wrap(text, width=22))
    return rounded_box(ax, x, y, w, h, wrapped, fc=fc, ec=ec, color=color, weight=weight, fontsize=fontsize, radius=0.16)


def render_payout_lifecycle():
    fig, ax = setup_canvas(14, 9)
    title(ax, "Payout Lifecycle", "Retry-safe state machine and double-pay guard", width=14)

    state_box(ax, 0.65, 6.25, 2.25, 0.82, "submission finalized (payable_amount set)")
    state_box(ax, 3.55, 6.25, 1.85, 0.82, "payout: requested")
    state_box(ax, 6.05, 6.25, 1.85, 0.82, "processing")
    state_box(ax, 9.0, 6.25, 1.65, 0.82, "paid", fc="#DCFCE7", ec=ACCENT, color=GREEN, fontsize=10)

    state_box(ax, 6.05, 4.25, 1.85, 0.82, "failed", fc=RED_SOFT, ec=RED, color=RED, fontsize=10)
    state_box(ax, 8.8, 4.25, 2.45, 0.82, "reconcile with provider (idempotency_key)", fc=FILL, ec=RED, fontsize=8.5)
    state_box(ax, 11.6, 5.45, 1.75, 0.82, "treat as paid", fc="#DCFCE7", ec=ACCENT, color=GREEN, fontsize=9)
    state_box(ax, 8.9, 2.45, 2.15, 0.82, "void payout_items", fc=RED_SOFT, ec=RED, color=RED, fontsize=9)
    state_box(ax, 5.75, 2.45, 2.25, 0.82, "submission released to pending", fc=RED_SOFT, ec=RED, color=RED, fontsize=8.5)
    state_box(ax, 2.85, 2.45, 2.0, 0.82, "NEW payout: requested", fc=FILL, ec=GREEN, fontsize=8.6)

    arrow(ax, (2.9, 6.66), (3.55, 6.66), text="batch", color=ACCENT, fontsize=7.4)
    arrow(ax, (5.4, 6.66), (6.05, 6.66), text="admin starts", color=ACCENT, fontsize=7.2, text_offset=(0, 0.18))
    arrow(ax, (7.9, 6.66), (9.0, 6.66), text="success", color=ACCENT, fontsize=7.4)

    arrow(ax, (6.98, 6.25), (6.98, 5.07), text="failure", color=RED, fontsize=7.4, text_offset=(0.45, 0))
    arrow(ax, (7.9, 4.66), (8.8, 4.66), text="before retry", color=RED, fontsize=7.2, text_offset=(0, 0.16))
    arrow(ax, (10.95, 5.03), (11.6, 5.8), text="provider paid", color=ACCENT, fontsize=7.1, rad=0.1, text_offset=(-0.08, 0.13))
    arrow(ax, (11.6, 6.0), (10.65, 6.55), color=ACCENT, rad=0.1)
    arrow(ax, (9.95, 4.25), (9.95, 3.27), text="not paid", color=RED, fontsize=7.2, text_offset=(0.45, 0))
    arrow(ax, (8.9, 2.86), (8.0, 2.86), color=RED)
    arrow(ax, (5.75, 2.86), (4.85, 2.86), color=RED)
    arrow(ax, (3.85, 3.27), (4.3, 6.25), text="fresh idempotency_key", color=ACCENT, rad=-0.28, fontsize=7.1, text_offset=(-0.7, 0.05))

    rounded_box(
        ax,
        0.9,
        0.96,
        5.8,
        0.86,
        "UNIQUE active payout_item per submission\n=> never double-paid",
        fc="#ECFDF5",
        ec=ACCENT,
        color=GREEN,
        fontsize=9,
        weight="bold",
    )
    rounded_box(
        ax,
        7.3,
        0.96,
        5.8,
        0.86,
        "idempotency_key sent to provider\n=> retry is safe after reconciliation",
        fc="#ECFDF5",
        ec=ACCENT,
        color=GREEN,
        fontsize=9,
        weight="bold",
    )

    ax.text(
        7,
        3.7,
        "Failure is not final until the provider is checked by idempotency key or external_ref.",
        ha="center",
        va="center",
        fontsize=8,
        color=MUTED,
    )

    fig.tight_layout(pad=0.25)
    fig.savefig(OUT_DIR / "03_payout_lifecycle.png", dpi=96)
    plt.close(fig)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    render_architecture()
    render_data_model()
    render_payout_lifecycle()

    for path in [
        OUT_DIR / "01_architecture.png",
        OUT_DIR / "02_data_model.png",
        OUT_DIR / "03_payout_lifecycle.png",
    ]:
        print(f"{path.name}: {path.stat().st_size} bytes")


if __name__ == "__main__":
    main()
