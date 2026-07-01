# Lumina Creators App — Architecture (v2, finalized)

> Companion to [`VIDEO_ANALYSIS.md`](./VIDEO_ANALYSIS.md) (what & why), [`SCHEMA.md`](./SCHEMA.md) (data model), and [`ARCHITECTURE_REVIEW.md`](./ARCHITECTURE_REVIEW.md) (the Codex-review + finalization decision record).
> This document defines **the total-app architecture**: stack, structure, auth, data flow, integrations, and deployment. **v2** folds in the finalized fixes: health-only public router, durable scraping, modeled refresh tokens, budget/double-pay safety, and the storage-finalize flow.

---

## 1. Locked stack

| Layer | Choice | Notes |
|---|---|---|
| **Frontend** | **Next.js 15** (App Router) + TypeScript + Tailwind | Two apps in one Next project via route groups: **creator** + **admin**. Mirrors the existing Lumina Clippers web frontend. |
| **Backend** | **FastAPI** (Python 3.11+) + SQLAlchemy 2.0 + Pydantic v2 + Alembic | REST/JSON. Async where it pays (scraping, uploads). |
| **Database** | **PostgreSQL on Render** | Single primary DB. Managed, Oregon region (co-locate with backend). |
| **Auth** | JWT (HS256), two realms (creator / admin) | httpOnly cookie on web; short-lived access + rotating refresh. |
| **Object storage** | S3-compatible (**Cloudflare R2** or AWS S3) | Portfolio videos, proof videos, avatars. Presigned uploads. |
| **View scraping** | **Apify** actors (per platform) | Same approach as existing Lumina Clippers. |
| **Payouts** | PayPal / Solana / Whop | Method stored per creator; payout run is admin-triggered. |
| **Hosting** | Frontend → **Vercel**; Backend + DB → **Render** | Autodeploy on push to `main`. |

**Design principle:** it's a **closed, service-based marketplace**. Only admins create campaigns; brands are never users of this system. Every API surface is one of exactly two audiences — `creator` or `admin` — and that boundary is enforced at the auth-dependency layer, not just the UI.

---

## 2. System overview

```
                         ┌────────────────────────────────────────────┐
                         │              Next.js (Vercel)                │
                         │                                              │
  Creator (phone/web) ──►│  /(creator)  app  ── react-query ─┐         │
                         │                                    │         │
  Admin (Lumina staff) ─►│  /(admin)    app  ── react-query ─┤         │
                         │                                    │         │
                         │        lib/api.ts  (typed fetch)   │         │
                         └────────────────────────────────────┼─────────┘
                                                              │ HTTPS + Bearer JWT
                                                              ▼
                         ┌────────────────────────────────────────────┐
                         │              FastAPI (Render)                │
                         │                                              │
                         │  routers/  creator/*   admin/*   public/*    │
                         │  deps:  get_current_creator / get_admin      │
                         │  services/  campaigns, submissions, payouts  │
                         │  scraping (Apify)   storage (R2)   auth (JWT) │
                         └───────────────┬───────────────┬──────────────┘
                                         │               │
                          ┌──────────────▼───┐   ┌───────▼───────────┐
                          │ Postgres (Render) │   │ External services │
                          │  SQLAlchemy/Alembic│  │ Apify · R2 · PayPal│
                          └───────────────────┘   │ Solana · Whop      │
                                                   └────────────────────┘
```

---

## 3. Repository layout (monorepo)

One repo, two deployables. Matches the existing `lumina-clippers-app` convention so patterns transfer.

```
lumina-creators-app/
├── docs/
│   ├── VIDEO_ANALYSIS.md
│   ├── ARCHITECTURE.md          ← this file
│   ├── SCHEMA.md
│   └── reference-frames/
├── frontend/                    ← Next.js (deploys to Vercel)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (creator)/       ← creator app route group
│   │   │   │   ├── login/
│   │   │   │   ├── onboarding/  ← mandatory profile builder
│   │   │   │   ├── campaigns/   ← browse + [slug] detail (2 modes)
│   │   │   │   ├── submissions/
│   │   │   │   └── earnings/
│   │   │   ├── (admin)/         ← admin app route group (protected)
│   │   │   │   ├── login/
│   │   │   │   ├── creators/    ← filterable database + [id] profile
│   │   │   │   ├── campaigns/   ← builder (CRUD), [id] edit
│   │   │   │   └── payouts/
│   │   │   ├── (client)/        ← client (brand) route group — read-only, obfuscated path
│   │   │   │   ├── login/
│   │   │   │   └── dashboard/   ← campaign stats + submissions (view-only)
│   │   │   ├── layout.tsx
│   │   │   └── globals.css      ← Lumina dark-green tokens
│   │   ├── components/          ← CampaignCard, CreatorCard, FilterBar, StatCard…
│   │   ├── lib/
│   │   │   ├── api.ts           ← typed API client (source of truth for types)
│   │   │   ├── auth.ts          ← session, guards
│   │   │   └── query.ts         ← react-query config
│   │   └── constants/theme.ts   ← colors, spacing, fonts
│   └── package.json
├── backend/                     ← FastAPI (deploys to Render)
│   ├── app/
│   │   ├── main.py              ← app factory, CORS, router mounts
│   │   ├── core/                ← config, security (JWT), deps
│   │   ├── db/                  ← engine, session, base
│   │   ├── models/              ← SQLAlchemy models (per SCHEMA.md)
│   │   ├── schemas/             ← Pydantic request/response models
│   │   ├── routers/
│   │   │   ├── creator/         ← auth, profile, campaigns, submissions, earnings
│   │   │   ├── admin/           ← creators, campaigns, submissions(verify), payouts, audit
│   │   │   └── public/          ← health ONLY (no public campaign data — closed model)
│   │   ├── services/            ← business logic (campaigns, earnings, completion, scraping, payouts)
│   │   ├── workers/             ← scrape_worker.py (Render cron)
│   │   └── integrations/        ← apify.py, storage.py, payments/
│   ├── alembic/                 ← migrations
│   ├── requirements.txt
│   └── render.yaml
└── README.md
```

> Alternative if you prefer hard isolation: split into `lumina-creators-web` and `lumina-creators-api`. Monorepo is recommended for a solo/small team — one PR spans both, shared docs, less drift.

---

## 4. Frontend architecture

- **Two apps, one project.** Route groups `(creator)` and `(admin)` keep bundles and layouts separate. Admin lives behind an obfuscated base path + admin-only guard (mirror the existing `/0x8f3a…` pattern).
- **Server state:** `@tanstack/react-query` — caching, pull-to-refresh equivalent, optimistic updates. No global store beyond a tiny `useAuth`.
- **Styling:** Tailwind with the **Lumina dark-green tokens** (see `constants/theme.ts` + `globals.css`). Cards/profiles/filters take their *structure* from Collabstr, their *skin* from Lumina.
- **API client:** one typed `apiFetch<T>` in `lib/api.ts`; every endpoint has a typed wrapper and exported response type. This file is the frontend's contract with the backend — keep it in lockstep with Pydantic schemas.
- **Auth on web:** access token in memory + httpOnly refresh cookie; on 401 → refresh once → else route to the correct login (`/login` creator vs admin login). Never put JWTs in `localStorage`.

Key screens map 1:1 to the video (see VIDEO_ANALYSIS §4): creator onboarding/profile, campaign browse, campaign detail with the **create-new vs copy-paste** split, earnings; admin creator-database (filterable), creator drill-down, campaign builder, payouts.

---

## 5. Backend architecture

- **App factory** (`main.py`): CORS (allow the Vercel origins), mount `creator`, `admin`, `public` routers under `/api/*`, exception handlers returning `{ "detail": "..." }`.
- **Models** (`models/`): SQLAlchemy 2.0 declarative, per `SCHEMA.md`. UUID PKs, `created_at/updated_at` mixin, Postgres enums.
- **Schemas** (`schemas/`): Pydantic v2 in/out models. Response models never leak `password_hash` or another creator's PII.
- **Routers** organised by **audience first, then domain** — because the audience is the security boundary:
  - `routers/creator/*` — every route depends on `get_current_creator`.
  - `routers/admin/*` — every route depends on `get_current_admin`.
  - `routers/client/*` — every route depends on `get_current_client`; **read-only**, scoped to the client's own campaigns (brand dashboard).
  - `routers/public/*` — **health check only.** No public campaign browse or anonymous submit — that would leak campaign economics/brand identity and break the closed model + mandatory-profile gate.
- **Services** (`services/`): all business logic. Routers stay thin (validate → call service → serialize). Earnings math, campaign publishing, profile-completion recompute, payout batching, and scrape orchestration live here.
- **Migrations:** Alembic, autogenerate + hand-review. No `create_all` in prod.
- **Background work is durable, not in-request.** Scraping runs through the **`scrape_jobs` table + a Render cron worker** (`workers/scrape_worker.py`), never FastAPI `BackgroundTasks`. Reason: earnings depend on scrape results, and in-process tasks are lost on deploy/restart, can double-fire Apify runs, and can't retry — any of which corrupts money. The worker pulls due jobs (`SELECT … FOR UPDATE SKIP LOCKED`), runs Apify idempotently (records `last_apify_run_id`), updates metrics, and reschedules until the campaign's retention window closes.

### Core service flows
1. **Admin launches a campaign** → `POST /api/admin/campaigns` (mode, cpm, budget, platforms, geo, brief_script *or* content_drive_url, rules) → status `draft`. `POST …/publish` runs **publish validation** (positive budget/CPM, ≥1 platform, valid dates, mode content present) → status `active`, `published_at` set → appears in creator browse. **Delete = archive** (`status='archived'`), never a hard cascade.
2. **Creator enters a campaign** → `POST /api/creator/campaigns/{slug}/join` (requires complete profile) → `campaign_participations` row.
3. **Creator submits a post** → `POST /api/creator/submissions` (participation, post_url) → canonicalize URL + hash (dedup), verify `platform ∈ campaign.platforms`, **snapshot `cpm_rate` + `eligible_view_pct`** onto the submission → enqueue `scrape_job`. Worker scrapes → recomputes `estimated_amount = views/1000 * cpm_rate_snapshot * eligible_view_pct_snapshot/100` (display precision) → creator sees it update.
4. **Verify + finalize** → for `create_new`, creator uploads a **proof video** (finalized `storage_object`); admin verifies (`verified_by/at`). When verified **and** retention met, a single transaction locks the campaign row (`FOR UPDATE`), sets `payable_amount = round(estimated, 2)` capped by remaining `budget` and `max_payout_per_creator`, and increments `campaigns.spent_amount`.
5. **Payout (retry-safe)** → admin batches finalized submissions with no *active* `payout_item` → one `payout` (with `idempotency_key`) + `payout_items` → `status='processing'` → provider transfer sent **with the idempotency key**. On success → `paid`. On failure → **reconcile against the provider first** (query by idempotency key / `external_ref`); if genuinely unpaid, mark `failed` and **void** the items (`voided_at`), which **releases the submissions back to pending** so a fresh payout can settle them. The partial-unique index (`one active item per submission`) preserves the no-double-pay guarantee across retries. Every publish/archive/verify/payout/suspend writes an `audit_log` row.

---

## 6. Auth & access model

Three independent identity realms, one enforcement pattern.

| | Creator | Admin | Client (brand) |
|---|---|---|---|
| Table | `creators` | `admins` | `clients` |
| Login | `POST /api/creator/auth/login` | `POST /api/admin/auth/login` | `POST /api/client/auth/login` |
| Token audience claim | `aud: "creator"` | `aud: "admin"` | `aud: "client"` |
| Dependency | `get_current_creator` | `get_current_admin` | `get_current_client` |
| Can create campaigns | ❌ | ✅ | ❌ |
| Access | own profile/campaigns/earnings | everything | **read-only**, own campaigns' stats + submissions |
| Sees creator PII / payouts | self only | full | ❌ never |

- JWT HS256 with `aud` (realm), `sub` (subject id), and `jti` claims. Access ~15 min; **refresh ~7 days, rotating and persisted in the `refresh_tokens` table** (store a hash + `jti`; rotate on use; revoke on logout / reuse-detection). The `aud` claim prevents a creator token from ever hitting an admin route.
- **Refresh delivery on web:** httpOnly, `Secure`, `SameSite` cookie scoped per realm path, with CSRF protection on the refresh endpoint. Never store JWTs in `localStorage`.
- **Mandatory-profile gate:** completion is **server-owned** — `creator_profiles.completed_at` is set only by `recompute_profile_completion()` (never a client-writable boolean). A creator with `completed_at IS NULL` may hit only profile/onboarding endpoints; campaign browse/enter returns `403 profile_incomplete`.
- **Admin authority:** payout processing and destructive admin mutations are gated on `admins.role` (owner/admin) and `is_active`.
- **Closed-marketplace invariant:** clients (brands) exist **only** as a read-only audience — there is no self-serve campaign-creation endpoint and no way for a client to reach/hire creators. Campaign writes stay admin-only; brands still book calls to launch. The `client` realm is read-only by construction (its router exposes no mutations).

### Client (brand) dashboard — scope

A minimal, view-only window into a brand's own campaign(s). Mirrors the existing platform's client view (`client.luminaclips.co/cx0-auth-8f3a/...`). Endpoints under `routers/client/*`, all filtered to `campaigns.client_id = current_client`:
- **Overview stats** per campaign: total submissions, total views, total interactions.
- **Submissions list/grid**: platform filter (all/tiktok/instagram/youtube/twitter/facebook), status filter, search, sort, CSV export, Grid/List toggle, post thumbnails/embeds.
- **Explicitly excluded:** earnings, CPM/payout data, creator PII beyond public handle, other clients' campaigns, any create/edit/delete action.
- Open question for Rhys: how much creator identity (handle vs email) is visible to clients — default to public handle only.

---

## 7. External integrations

- **Apify** (`integrations/apify.py`) — per-platform actors scrape `views/likes/comments`. Driven by the `scrape_jobs` queue (not called inline); each run records `last_apify_run_id` for idempotency and retries with backoff via `next_run_at`/`attempts`.
- **Object storage** (`integrations/storage.py`) — S3/R2 with a **presign → upload → finalize** lifecycle tracked in `storage_objects` (owner, purpose, key, size, content_type, checksum, status). An object must be `finalized` (type/size/scan validated) server-side before it can be attached to a profile, portfolio item, or submission proof. Store keys, not public URLs.
- **Google Drive** — for `copy_paste` campaigns we **store a Drive folder URL** on the campaign (`content_drive_url`); creators open it to grab approved clips. No Drive API needed initially.
- **Payouts** — PayPal / Solana / Whop adapters behind a common `PayoutProvider` interface; a creator has one default method (provider fields validated by `chk_method_fields`).

---

## 8. Deployment & environments

- **Frontend → Vercel:** autodeploy on push to `main`. Env: `NEXT_PUBLIC_API_URL`.
- **Backend → Render:** `render.yaml` with **two services** — a web service (FastAPI) and a **cron job** running `scrape_worker.py` on a short interval to drain `scrape_jobs`. Autodeploy on push. Env: `DATABASE_URL`, `JWT_SECRET`, `APIFY_TOKEN`, `R2_*`/`S3_*`, `PAYPAL_*`, CORS origins.
- **DB → Render Postgres** (Oregon). Migrations run on deploy (`alembic upgrade head` in the start command).
- **No staging** initially (matches existing platform) — test against prod with low-stakes accounts, or add a `dev` Render service later.

### Env var inventory (starter)
```
# backend/.env
DATABASE_URL=postgresql+psycopg://...
JWT_SECRET=...
JWT_ACCESS_TTL_MIN=15
JWT_REFRESH_TTL_DAYS=7
APIFY_TOKEN=...
R2_ACCOUNT_ID=...  R2_ACCESS_KEY_ID=...  R2_SECRET_ACCESS_KEY=...  R2_BUCKET=...
PAYPAL_CLIENT_ID=...  PAYPAL_SECRET=...
CORS_ORIGINS=https://creators.luminaclippers.com,https://admin.luminaclippers.com

# frontend/.env.local
NEXT_PUBLIC_API_URL=https://lumina-creators-api.onrender.com
```

---

## 9. Security & integrity notes

- JWT `aud` separation; admin base path obfuscated **and** guarded (obfuscation is not security by itself).
- All PII/read-of-other-creators is admin-only; creator endpoints are self-scoped by the token subject.
- Rotating refresh tokens hashed at rest in `refresh_tokens`; reuse-detection revokes the family.
- Uploads scoped to the authenticated creator; validated + `finalized` before attach; keys not public URLs.
- Rate-limit auth + submit endpoints. Secrets only via env; never logged.
- **Money integrity:** `NUMERIC` never float; rates/estimates at 4dp, settle at 2dp; earnings priced off **snapshots** so later campaign edits can't rewrite history.
- **Budget & double-pay safety:** finalization locks the campaign row (`FOR UPDATE`) and caps against `budget`/`max_payout_per_creator`. A submission may have **at most one _active_ `payout_item`** (partial-unique), so it can never be paid twice — yet a **failed payout voids its items**, releasing the earning for retry (no stranded earnings). Provider transfers carry a per-payout **idempotency key** and are **reconciled before being marked failed**, so a timed-out-but-succeeded transfer can't become a double send.
- **No destructive cascades on financial data:** campaigns/participations/submissions are `ON DELETE RESTRICT`; admin "delete" is archive.

---

## 10. Build order (milestones)

1. **Foundation** — repo, backend app factory + DB + Alembic baseline (with `pgcrypto`/`citext`), frontend scaffold + theme + `api.ts`, health check green end-to-end.
2. **Auth (both realms)** — creator signup/login + admin login, `refresh_tokens` rotation, JWT deps, guards.
3. **Uploads** — `storage_objects` presign→finalize (needed by profile + submissions).
4. **Creator profile (mandatory)** — onboarding builder, socials, portfolio uploads, **server-owned completion** gate.
5. **Admin creator database** — filterable grid (age/gender/ethnicity/language/location/platform/followers) + drill-down profile.
6. **Campaign builder (admin)** — CRUD, both modes, publish validation, archive (soft-delete) → appears in creator browse.
7. **Creator campaign browse + enter + submit** — cards, detail (2 modes), participation, submission with URL-canonicalize + rate snapshot.
8. **Durable scraping + earnings** — `scrape_jobs` + Render cron worker, Apify, live estimate, finalize with budget lock.
9. **Payouts** — payment methods (validated), admin payout batch via `payout_items`, audit logging.
10. **Client (brand) dashboard** — `clients` realm + `campaigns.client_id`, read-only `routers/client/*`, brand stats + submissions view. (Lightweight; can slot after admin is stable.)
11. **Polish + deploy** — Vercel + Render web + Render cron, seed/test accounts.

---

## 11. Decisions made by default (confirm if you disagree)

- Monorepo `frontend/` + `backend/` (not two repos).
- **Fresh standalone backend + DB** built from scratch (not extending the existing `lumina-clippers-api`), while **reusing its patterns** (Apify scraping, CPM earnings, payout methods) and its `CONTEXT.md` as prior art.
- Web-first (creator app responsive/mobile-friendly); native Expo app is a later phase.
- Cloudflare R2 for uploads (S3-compatible; swap to AWS S3 trivially).
- Separate creator/admin JWT realms rather than one `users` table with a role column.
- **Creator signup:** self-signup (email+password) is primary; admin-invite/migrated creators (`signup_source`) set a password on first login — the only reason `creators.password_hash` is nullable.
- **Brand identity is creator-visible** (name/logo on campaign cards); "closed" means brands aren't *users*, not that campaigns are anonymous.
- **Pay-once-per-submission** model → active-unique `payout_items` (≤1 non-voided item per submission) instead of a separate earnings ledger. Revisit only if incremental (view-growth) payouts are needed.
- Deferred as premature: `campaign_platforms`, `creator_search` materialized view, admin MFA, per-run scrape history — see `SCHEMA.md` "Deferred".
