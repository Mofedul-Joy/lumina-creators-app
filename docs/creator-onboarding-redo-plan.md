# Creator Onboarding Redo — SideShift-style progressive wizard

## Context

The current creator onboarding (`/onboarding`) is a **single tabbed profile page** (Personal / Social / Portfolio / Payment). The client's feedback: for a UGC platform this reads as a generic settings form — "pretty much a copy-paste of what we have with some UI changes" — not a guided creator experience. The reference app **SideShift** uses a **progressive, one-question-per-screen wizard** that makes building a profile feel fast and rewarding (type → platforms → social handles → best videos → details → payment → done), which is what a UGC creator flow should feel like.

**Goal of this pass:** rebuild the creator onboarding into that stepped wizard so a creator can "create a profile and get paid, quite easily."

**Direction locked with the user (3 answers):**
- **Design:** keep the existing **dark-green Lumina theme**; adopt SideShift's progressive **flow + card layouts only** (not their light-blue skin).
- **Scope:** **onboarding wizard only** this pass. (Dashboard campaign-brief-on-page and the admin "Creators" gallery are explicitly later passes.)
- **Socials:** **manual handle + link** (reuse the existing `SocialAccount` model; no OAuth).

De-risking fact from exploration: there is **no server-side completion gate** — `services/profile.py` has `_REQUIRED_FIELDS = ()` and `join_campaign` does not gate on completion. Every section already persists independently (`updateProfile`, `addSocial`, `uploadPortfolioVideo`). So a save-as-you-go wizard is safe and needs no new gating logic.

---

## Approach — a stepped wizard at `/onboarding`

Rebuild `frontend/src/app/(creator)/(app)/onboarding/page.tsx` from a tabbed page into a **single-page wizard driven by internal step state**, with a top progress/stepper. Each step persists on **Continue** via the existing APIs (save-as-you-go). Every step **pre-fills from the loaded profile**, so the same wizard doubles as "edit profile" — the stepper lets a returning creator jump to any step. One section per screen, centered and large, dark-green `card-grad` panels, brand-green primary button, Back / Continue / "Skip for now" on optional steps, ambient background showing through.

### Steps (M ≈ 7)
1. **Welcome + creator type** — short value-prop intro + "What kind of creator are you?" (**UGC / Influencer / Both**). Stores a new optional `creator_type`.
2. **Your details** — `display_name`, avatar upload (reuse `uploadFile` purpose `avatar` + progress bar), `bio`.
3. **Your socials** — platform grid (`PlatformIcon`) → per-platform `handle` + `follower_count` + optional link (reuse `addSocial`/`deleteSocial`). "Creators with 3+ platforms get matched to more campaigns" nudge.
4. **Your best videos** — portfolio **video uploads** (reuse `uploadPortfolioVideo` + progress + inline `<video>` players + `deletePortfolio`).
5. **Audience (optional, skippable)** — `date_of_birth`, `gender`, `ethnicity`, `primary_language`, `country`, `city` (reuse `updateProfile`). Clearly optional/skippable.
6. **Getting paid** — payout method + per-method address (reuse the per-method payout shipped this session: `updateProfile` with `payout_paypal`/`payout_solana`/`payout_whop`).
7. **Done** — celebration + a **profile-strength recap** (derived from `ProfileOut.completed` / `missing`) + prominent **"Browse campaigns" → `/campaigns`**.

Progress UI: a clickable stepper (jump between steps) + "Step N of M" + a lightweight profile-strength meter (encouragement, not a gate).

### New componentization (keeps the page readable)
- `frontend/src/components/creator/onboarding/OnboardingWizard.tsx` — shell: owns step state + stepper/progress + Back/Continue/Skip; loads profile + socials + portfolio once; passes data + a `save()` down.
- `frontend/src/components/creator/onboarding/steps/*.tsx` — one file per step (`WelcomeType`, `Details`, `Socials`, `Portfolio`, `Audience`, `Payment`, `Done`). Reuse `Field`, `Button`, `PlatformIcon`/`platformLabel`, `Skeleton`.
- `onboarding/page.tsx` becomes a thin wrapper rendering the wizard, preserving deep-links by mapping the old `?tab=` to `?step=` (e.g. `?step=payment` from the dashboard payout gate, `?step=portfolio` from the dashboard "Upload a portfolio video" card).

### Backend (minimal — one additive change)
- Add **`creator_type`** (nullable `Text`) to `CreatorProfile`:
  - migration `backend/alembic/versions/0011_creator_type.py`
  - add to `ProfileIn`/`ProfileOut` (`backend/app/schemas/profile.py`), the `update_profile` whitelist + a validation set `{ugc, influencer, both}` (`backend/app/services/profile.py`), and `_profile_out` (`backend/app/routers/creator/profile.py`)
  - frontend: `ProfileIn`/`ProfileOut` + a `CREATOR_TYPES` const in `frontend/src/lib/api.ts`
- Everything else the wizard needs already exists (per-method payout, portfolio-video upload, socials, avatar upload). **No other backend work.**
- *(If you'd rather ship zero schema change, Step 1 becomes welcome-only and we drop `creator_type`. Recommendation: keep it — it's a core, cheap SideShift step and useful signal for brands.)*

### Small fixes folded in (found during exploration)
- `frontend/src/lib/api.ts` `GENDERS` omits `non_binary` that the backend accepts → add it.
- Route new creators into the wizard: on `frontend/src/app/c/[slug]/success/page.tsx`, a **new** creator (set-password branch) goes to `/onboarding` instead of `/dashboard`; returning login stays `/dashboard`.
- Remove the stray `console.log(data.access_token)` at `frontend/src/app/(creator)/set-password/page.tsx:22`.

---

## Critical files
- **Rewrite:** `frontend/src/app/(creator)/(app)/onboarding/page.tsx`
- **New:** `frontend/src/components/creator/onboarding/OnboardingWizard.tsx` + `steps/{WelcomeType,Details,Socials,Portfolio,Audience,Payment,Done}.tsx`
- **Backend:** `backend/alembic/versions/0011_creator_type.py`, `backend/app/models/profile.py`, `backend/app/schemas/profile.py`, `backend/app/services/profile.py`, `backend/app/routers/creator/profile.py`
- **Frontend lib:** `frontend/src/lib/api.ts` (Profile types + `CREATOR_TYPES` + `GENDERS` fix)
- **Redirect / cleanup:** `frontend/src/app/c/[slug]/success/page.tsx`, `frontend/src/app/(creator)/set-password/page.tsx`

## Reuse (already built — do NOT rebuild)
- APIs: `updateProfile`, `addSocial`/`deleteSocial`, `uploadFile`/`uploadPortfolioVideo`/`listPortfolio`/`deletePortfolio`, `getProfile`/`getCompletion` (`frontend/src/lib/api.ts`)
- UI primitives: `Field`, `Button`, `PlatformIcon`+`platformLabel`, `Skeleton*`, `LuminaMark`; classes `card-grad`/`card-lumina`/`card-interactive`; token palette + ambient background (`globals.css`)
- Per-method payout + portfolio-video upload (both shipped earlier this session)

## Verification
- **Backend:** venv import test (`import app.main`) + `alembic upgrade head` on the staging branch DB; exercise `PUT /api/creator/profile` with `creator_type` and confirm it round-trips in `GET`.
- **Frontend:** `vercel` build clean (typecheck + lint), then walk the flow on staging as a fresh creator: sign up → wizard steps 1→7, confirming each saves (reload mid-wizard resumes with data intact) → skip the optional Audience step → land on Done → "Browse campaigns". Confirm the sidebar "Profile" re-enters the stepper pre-filled (edit mode), and that `?step=payment`/`?step=portfolio` deep-links still land on the right step.
- **Deploy:** Vercel (frontend) + Render branch backend `srv-d94u02vaqgkc73ed82gg` (migration runs on build) — trigger both manually (branch auto-deploy is unreliable). Verify `readyState=READY` + the `creator_type` field live in `/openapi.json`.

## Notes
- This is intentionally the **onboarding wizard only**. The client's other two asks — reading the full campaign brief inline on the dashboard (no Google-Doc link) and the admin "Creators" gallery (avatars, recent videos, social links) — are separate follow-up passes, not in this plan.
- On approval I'll also drop a copy of this plan into `lumina-creators-app/docs/` so it lives with the repo (plan mode restricts writes to this file only for now).
