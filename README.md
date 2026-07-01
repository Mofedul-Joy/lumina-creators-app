# Lumina Creators

A closed, service-based **UGC creator platform** for Lumina — the creator-side counterpart to Lumina Clippers. Creators build a profile, browse brand campaigns, submit posts, and get paid per 1,000 views. Lumina staff manage a filterable creator database and build campaigns. Brands get a read-only dashboard of their campaign stats.

> Status: **work in progress.** Backend API and core frontend screens are built; end-to-end run pending a hosted Postgres.

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

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design
- [`docs/SCHEMA.md`](docs/SCHEMA.md) — database schema (16 tables)
- [`CONTEXT.md`](CONTEXT.md) — build context for contributors
- [`docs/VIDEO_ANALYSIS.md`](docs/VIDEO_ANALYSIS.md) — requirements walkthrough

---

_Private client project. Not affiliated with any third-party brand referenced in campaigns._
