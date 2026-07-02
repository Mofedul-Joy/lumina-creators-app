# Lumina Creators

A closed, service-based **UGC creator platform** for Lumina — the creator-side counterpart to Lumina Clippers. Creators build a profile, browse brand campaigns, submit posts, and get paid per 1,000 views. Lumina staff manage a filterable creator database and build campaigns. Brands get a read-only dashboard of their campaign stats.

> Status: **feature-complete locally, verified end-to-end.** All three realms (creator, admin, client) work against a hosted Postgres, covered by 4 Playwright E2E suites. Cloud deployment (Vercel + Render) is the remaining step.

---

## Three realms

| Realm | Who | What they do |
|-------|-----|--------------|
| **Creator** | Signed-up creators | Build a mandatory profile, browse campaigns, submit posts, track earnings |
| **Admin** | Lumina staff | Filterable creator database + campaign builder |
| **Client** | Brands | Read-only dashboard of their campaign performance |

## Two campaign modes

- **`create_new`** — creator films original UGC from a script/brief (higher pay).
- **`copy_paste`** — creator reposts approved clips from a provided Drive folder (lower pay).

---

## Stack

- **Frontend:** Next.js 15 (App Router) + Tailwind v4 → Vercel
- **Backend:** FastAPI + SQLAlchemy 2.0 + Alembic → Render
- **Database:** PostgreSQL → Render
- **Auth:** JWT (HS256) with `aud`-claim realm isolation (creator / admin / client) + rotating refresh tokens

## Architecture at a glance

```
Next.js (Vercel)  ──HTTPS/JWT──►  FastAPI (Render)  ──►  PostgreSQL (Render)
   3 realm UIs                     audience-first routers        16 tables
                                   /api/creator  /api/admin  /api/client
```

Security boundary is enforced at the router layer: each realm has its own router group and its own JWT audience, so a creator token can never call an admin endpoint.

## Repository layout

```
lumina-creators-app/
├── backend/            FastAPI service
│   ├── app/
│   │   ├── core/       config, security (JWT + bcrypt), deps
│   │   ├── models/     16 SQLAlchemy models
│   │   ├── routers/    creator / admin / client / public
│   │   └── services/   business logic
│   ├── alembic/        migrations (0001 baseline)
│   └── render.yaml
├── frontend/           Next.js 15 app
│   └── src/
│       ├── app/        (creator) (admin) (client) route groups
│       ├── components/ landing, auth, campaign, admin
│       └── lib/        typed API client + auth token holders
└── docs/               ARCHITECTURE, SCHEMA, CONTEXT, VIDEO_ANALYSIS
```

## Local development

**Backend**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set DATABASE_URL + JWT_SECRET
alembic upgrade head
uvicorn app.main:app --reload # http://localhost:8000
```

**Frontend**
```bash
cd frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                        # http://localhost:3000
```

**Dev accounts + demo data**
```bash
cd backend
.venv/bin/python scripts/seed_dev.py   # admin@lumina.dev / client@lumina.dev (dev passwords printed)
```
Creators self-serve via `/signup`. Uploads work locally with no R2 account — when
R2 env vars are unset the API stores files on local disk (dev-only fallback).

**End-to-end tests** (Playwright, servers must be running)
```bash
python e2e/creator_flow.py          # signup → onboarding → profile complete
python e2e/admin_and_join_flow.py   # admin campaign → creator joins + submits
python e2e/client_flow.py           # client-linked campaign → brand dashboard
python e2e/edge_cases.py            # error states & guards
```

## Deployment (planned)

- **Frontend → Vercel**: root `frontend/`, env `NEXT_PUBLIC_API_URL=<render api url>`.
- **Backend → Render**: `backend/render.yaml` blueprint; env `DATABASE_URL`, `JWT_SECRET` (long random), `CORS_ORIGINS=<vercel url>`, plus R2 credentials for real uploads.
- **Database**: Render Postgres (`alembic upgrade head` once against it).

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design
- [`docs/SCHEMA.md`](docs/SCHEMA.md) — database schema (16 tables)
- [`CONTEXT.md`](CONTEXT.md) — build context for contributors
- [`docs/VIDEO_ANALYSIS.md`](docs/VIDEO_ANALYSIS.md) — requirements walkthrough

---

_Private client project. Not affiliated with any third-party brand referenced in campaigns._
