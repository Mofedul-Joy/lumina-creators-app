# Lumina Creators App — Master Context

> **Read this first.** This is the single entry-point briefing for the coding agent building the Lumina Creators App. It states what we're building, the rules that must never be broken, the stack, and where the detail lives. If anything here conflicts with code, the code + migrations win — but check with Rhys before diverging from the **golden rules**.

## The docs
1. **`CONTEXT.md`** (this file) — the map + the rules.
2. **`docs/ARCHITECTURE.md`** (v2) — stack, repo structure, auth, data flow, integrations, deployment, build order.
3. **`docs/SCHEMA.md`** (v2) — the finalized high-priority PostgreSQL data model.
4. **`docs/ARCHITECTURE_REVIEW.md`** — the Codex adversarial review + Claude's finalization decisions (what was accepted, rejected, and why). Read this to understand *why* v2 differs from v1.
5. **`docs/VIDEO_ANALYSIS.md`** — the founder's brief, frame-by-frame, with `docs/reference-frames/` screenshots. The *why* behind the product.

---

## 1. What we're building (one paragraph)

A brand-new, **closed / service-based** creator platform for Lumina with three surfaces sharing one backend: a **creator app** (creators sign up, build a mandatory rich profile, browse Lumina's campaigns, and participate), an **admin app** (Lumina staff run a private, filterable creator database and a campaign builder), and a **client (brand) dashboard** (read-only view of a brand's own campaign stats + submissions). Campaigns come in **two modes** — *create-new UGC* (creator films original content from a script; higher pay) and *copy-paste* (creator reposts approved clips from a provided Google Drive folder; lower pay). We are building the **system** ("the ship"), not any individual campaign — it must support one campaign or a hundred, each unique.

## 2. Golden rules (do not break)

1. **Closed marketplace.** **No self-serve campaign creation** — only admins create campaigns; brands book calls to launch. Brands (clients) *do* have accounts, but **only a read-only dashboard** scoped to their own campaigns — they can't create/edit anything or reach/hire creators. Do not build a public "post a campaign" endpoint or a public campaign-browse route. The **public router is health-only**.
2. **Three audiences, enforced at the auth layer.** Every API route belongs to `creator`, `admin`, or `client`, guarded by `get_current_creator` / `get_current_admin` / `get_current_client` with JWT `aud` separation. A token from one realm must never reach another realm's route. The `client` realm is **read-only** (its router exposes no mutations); clients never see creator PII, earnings, or payouts.
3. **Mandatory creator profile, server-verified.** A creator can't browse or enter campaigns until their profile is complete. Completion is **server-owned** (`creator_profiles.completed_at`, set only by `recompute_profile_completion()`) — never a client-writable boolean. `completed_at IS NULL` → `403 profile_incomplete`.
4. **Two campaign modes are first-class.** `create_new` vs `copy_paste` (`campaign_mode` enum). Mode determines the creator experience (script vs Drive clips) and payout tier. The DB constraint `chk_mode_content` must hold. (`create_new` requires proof-video verification; `copy_paste` typically does not.)
5. **Financial integrity is non-negotiable.** Money is `NUMERIC` never float (rates/estimates 4dp, settle 2dp). Earnings are priced off **snapshots** (`cpm_rate_snapshot`) so editing a campaign never rewrites past earnings. Finalization locks the campaign row and caps against `budget`/`max_payout_per_creator`. A submission may have **at most one _active_ `payout_item`** — it can never be paid twice — but a **failed payout voids its items and releases the earning for retry** (no stranded earnings); provider transfers use an **idempotency key** and are **reconciled before being marked failed**. Campaign "delete" is **archive**, never a hard cascade over financial rows.
6. **Don't leak PII.** Creator endpoints are self-scoped; full creator data (emails, socials, demographics) is admin-only.
7. **Durable background work.** Scraping runs through the `scrape_jobs` table + a Render cron worker — never in-request `BackgroundTasks` (lost jobs corrupt earnings).

## 3. Stack (locked)

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind → Vercel. Two apps via route groups `(creator)` + `(admin)`.
- **Backend:** FastAPI (Python 3.11+) + SQLAlchemy 2.0 + Pydantic v2 + Alembic → Render.
- **Database:** PostgreSQL on Render (Oregon).
- **Auth:** JWT HS256, three realms (creator/admin/client — client is read-only), httpOnly refresh cookie on web.
- **Storage:** Cloudflare R2 (S3-compatible) for videos/avatars, presigned uploads.
- **Scraping:** Apify actors for view/like counts. **Payouts:** PayPal / Solana / Whop.

## 4. Repo shape (monorepo)

```
lumina-creators-app/
├── CONTEXT.md            ← this file
├── docs/                 ← ARCHITECTURE.md, SCHEMA.md, VIDEO_ANALYSIS.md, reference-frames/
├── frontend/             ← Next.js (Vercel)   → src/app/(creator|admin|client)/…, lib/api.ts
└── backend/              ← FastAPI (Render)    → app/{models,schemas,routers/{creator,admin,client,public},services,integrations}, alembic/
```
Full tree + rationale in `ARCHITECTURE.md §3`.

## 5. The core screens (map to the video)

**Creator app:** login → **onboarding/profile** (name, avatar, bio, socials + follower counts, demographics, portfolio uploads) → **campaign browse** (cards: CPM, payout, budget, platforms) → **campaign detail** with the create-new / copy-paste split → **submit** posted URL → **earnings/payouts**.

**Admin app:** login → **creator database** (filter by age, gender, ethnicity, language, location, platform, followers — free & native; Collabstr paywalls these) → **creator drill-down** (socials, followers, past posts, bio) → **campaign builder** (CRUD, both modes, publish → appears in creator browse) → **payouts**.

**Client (brand) dashboard (read-only):** login → **dashboard** scoped to their campaign(s): campaign + status filter, stat cards (Total Submissions / Total Views / Interactions), submissions grid/list (platform filter, search, CSV export, Grid/List). No mutations, no earnings, no creator PII. Mirrors the existing platform's `client.luminaclips.co/cx0-auth-8f3a/...` view.

**Design:** Collabstr's *structure* (cards, rich profiles, filter chips + modals, database grid) on Lumina's *skin* (dark near-black + green-500 `#22c55e`, mono numerals). See `reference-frames/`.

## 6. How to work here

- Follow the **build order** in `ARCHITECTURE.md §10`: foundation → auth → creator profile → admin database → campaign builder → browse/enter/submit → scraping/earnings → payouts → deploy.
- Keep `frontend/src/lib/api.ts` (typed client) in lockstep with backend Pydantic schemas — it's the contract.
- Schema changes go through **Alembic migrations**, never `create_all` in prod. `docs/SCHEMA.md` is intent; migrations are truth.
- Routers stay thin; business logic lives in `services/`.
- Prior art worth copying: the existing Lumina Clippers backend/frontend (`~/Downloads/Workspace - Antigravity #1/lumina-snapshot-earlier-2026/CONTEXT.md`) already solves auth, Apify scraping, CPM earnings, and payout methods — reuse its patterns, but this is a **fresh standalone backend + DB**.
- **Project location:** this project lives at `~/Downloads/lumina-creators-app` (moved out of the `…/Workspace - Antigravity #1/` workspace because the `#` in that folder name crashes Tailwind v4 / Next's path resolver locally). Backend is path-agnostic; the frontend must stay on a `#`-free path for `next dev`/`build`. Vercel/Render use clean paths, so production is unaffected.

## 7. Open questions for Rhys (still genuinely need your call)

1. **Which side first** to build after the shared foundation — creator app or admin app?
2. **Relationship to the existing live portal** — does this replace the current creator dashboard, or run alongside it? If replace, do we migrate existing clippers/campaigns (drives the `signup_source='migrated'` path)?
3. **Payout timing** — pay **once per submission** when finalized (current assumption, active-unique `payout_items`), or **incrementally** as views keep growing? Incremental needs an earnings-events ledger.
4. **`eligible_view_pct`** — do we discount earnings by eligible-region viewers (like the existing platform's US-viewer %), and is it per-campaign or scraped per-submission? (Defaulted to 100 / per-campaign snapshot.)
5. **Uploads** — R2 vs the existing platform's storage; size/format limits for portfolio + proof videos?

**Resolved by v2 defaults** (flag if you disagree): demographics are **self-reported at signup** (admin can edit); `create_new` verification = **proof-video upload + admin review**; creator signup is **self-serve primary** with an admin-invite path; brand **name/logo shown** on cards; **separate creator/admin subdomains** (`creators.` + obfuscated admin path).

---

*Everything above is grounded in the founder's Loom walkthrough (fully analyzed in `docs/VIDEO_ANALYSIS.md`) and the existing Lumina Clippers platform. Default architectural decisions are listed in `ARCHITECTURE.md §11` — flag any you'd change.*
