# Lumina Creators — Production Hardening (ugcagency.io)

Autonomous stress-test & harden loop. Goal: 100% production-ready across all three
subdomains, everything on ugcagency.io, zero issues on a full pass.

## Live targets
- Frontend (Vercel): project `lumina-creators-app`, scope `rhysmckay7777s-projects`
- Backend (Render): `lumina-creators-api-app.onrender.com` (`srv-d97tf1rtqb8s73dl744g`)
- DB (Render): `lumina_creators` / `dpg-d92v6amh2hms73cv40g0` — **NEVER** touch `lumina_creators_staging` (Bill's)
- Subdomains: `creators.ugcagency.io` (creator), `admin.ugcagency.io` (admin), `client.ugcagency.io` (client)

## Methodology (cited)
- **OWASP Web Security Testing Guide (WSTG)** — security dimension: Authentication (ATHN),
  Authorization/access-control incl. IDOR + privilege escalation (ATHZ), Session mgmt (SESS),
  Input validation incl. XSS/injection (INPV), Business logic (BUSL).
- **Google SRE Production Readiness Review (PRR)** — functional E2E, reliability, error/loading
  states, UX friction.

## Test matrix (per persona × category)
| Category | Creator | Admin | Client |
|---|---|---|---|
| Auth (login/logout/signup/reset) | | | |
| Authorization / cross-realm isolation | | | |
| Session (token expiry, refresh) | | | |
| Input validation (XSS/injection/malformed) | | | |
| Business logic (join/submit/payout/review) | | | |
| Cross-subdomain data sync | | | |
| UX friction (dead buttons, error/loading states, console errors) | | | |

---

## Findings log

Format: `[SEV] [persona] area — description → status`
SEV: P0 (blocker/security), P1 (major bug), P2 (minor bug), P3 (friction/polish)

### Pass 1

**Test accounts (prod DB, additive):** creator `qa.creator@ugctest.dev`, admin `qa.admin@ugctest.dev`, client `qa.client@ugctest.dev` — all pw `QaTest2026!`. All 3 authenticate (200 + tokens).

**✅ PASS — Cross-realm authorization (WSTG-ATHZ), API level.** Token×endpoint matrix: every realm's endpoints reject the other realms' tokens (401) and no-token (403); only the matching realm returns 200. JWT audience enforced. Tested: /api/admin/{creators,clients,stats}, /api/client/campaigns, /api/creator/profile.

_Browser E2E + parallel subagent fuzzing in progress…_

#### Findings — Pass 1

- **P0 · security · unauthenticated file upload/overwrite** — `PUT /uploads/local/{object_key}` and `PUT /uploads/r2/{object_key}` (`backend/app/routers/public/uploads_local.py:34-46,61-78`) have NO auth. The presign step is auth-gated but the byte-writing PUT is fully public → anyone can overwrite any finalized file (avatars/thumbnails/banners, whose keys leak in public URLs) or upload arbitrary content served under the app origin. Bounded only by max_upload_bytes. → **FIX:** HMAC signed+expiring token in the PUT path issued at presign, verified here (or require the owning authenticated session).
- **P1 · security · public-submit account takeover** — unauth `POST /api/public/campaigns/{slug}/submit` → `_get_or_create_creator` (`backend/app/services/public_submit.py:26-56`) reuses an existing creator by email with no password/OTP check; `GET /api/creator/auth/check-email` enables email enumeration. Attacker can join campaigns / submit post URLs as a real creator. → **FIX:** if the email already has a password_hash, reject with "account exists, sign in".
- **P2 · security · no login rate-limiting** — `_password_login` + `creator_login` (`backend/app/services/auth.py`) have no attempt throttle (OTP path does). All 3 `/auth/login` routes allow unlimited password guesses. → **FIX:** per-account/IP throttle.
- **P3 · security · admin self-mint no role check** — `admin/users.py:103-114` any admin can create admins; `Admin.role` (owner/admin/staff) never enforced. Flag only if the distinction is intended.
- **P3 · security · impersonation token use not inspected** — `create_impersonation_token` sets `imp_by` but `get_current_client` never checks it; short TTL + audit log mitigate.
- **P3 · security · markdown link scheme** — `frontend/src/components/ui/Markdown.tsx:47-60` no `javascript:` scheme allow-list; only admin-authored fields feed it today (not untrusted input).
- **P3 · ux · Clearbit console spam** — onboarding "brands" step fires ~14 `logo.clearbit.com` `ERR_NAME_NOT_RESOLVED` (Clearbit logo API is dead post-HubSpot). Visual fallback (letter/favicon avatar) works, so cosmetic — but spams console. → **FIX:** drop Clearbit or guard so failures don't hit console; prefer local/letter avatars.
- **P2 · ux · empty display-name bypass** — onboarding step 1 "What should we call you?" (the brand-facing name) advances on Continue with an empty field; not gated. → **FIX:** require non-empty display_name to continue (small gate like the WhatsApp one).
- **P3 · ux · dashboard flash before onboarding** — fresh creator login briefly renders `/dashboard` before the client-side gate redirects to `/onboarding`. → **FIX:** gate before first paint (or show a neutral splash).

**✅ PASS — Admin persona (browser):** login, dashboard (real stats + chart), creators (12 rows, pagination, export/invite), payments (Payouts, Pay All) — all render, 0 console errors, data synced. Destructive admin actions not exercised on real prod data.
**✅ PASS — Client persona (browser):** login → /client/dashboard read-only ("No campaigns yet" empty state), 0 errors.

#### Findings — Pass 1 (frontend UX review) — SUBDOMAIN-MIGRATION REGRESSIONS

- **P1 · routing · "View as client" 404 from admin subdomain** — `components/admin/ClientSubmissionsPanel.tsx:58` + `app/(admin)/admin/campaigns/[id]/edit/page.tsx:96` `window.open('/client/dashboard?impersonate_token=…')` (relative). On admin.ugcagency.io middleware rewrites → `/admin/client/dashboard` → 404. → **FIX:** absolute URL to `client.ugcagency.io`.
- **P1 · routing · client invite link 404** — `app/(admin)/admin/users/page.tsx:84` `${window.location.origin}/client/login?email=…` → `/admin/client/login` → invited brand hits 404. → **FIX:** client-subdomain absolute URL.
- **P1 · routing · client report share link 404** — `components/admin/SharePageLink.tsx:28` `${window.location.origin}/report/${token}` → `/admin/report/[token]` → flagship "share with client" broken from admin subdomain. → **FIX:** absolute URL to a host where `/report` resolves (apex/creators).
- **P1 · ux · payout CTA dead-ends onboarding** — `submissions/page.tsx:399` + `components/creator/ProfileGateModal.tsx:27` link `/onboarding?tab=payment`, but the payment step was removed from `STEPS`; `resolveInitialStep('payment')` → index 0 → creator dumped on "What should we call you?" with no payout path. → **FIX:** repoint to `/account` (PayoutDetailsCard).
- **P2 · ux · Avatar no onError** — `components/admin/Avatar.tsx:9-13` broken-image glyph instead of initials (widely used). → **FIX:** onError→initials.
- **P2 · ux · public report imgs no onError** — `app/report/[token]/page.tsx:60,110,125` external client-facing page, dead CDN links show broken boxes; `SubmissionThumbnail` fallback exists but unused. → **FIX:** reuse fallback.
- **P2 · ux · invited page no gate/error branch** — `app/(creator)/(app)/invited/page.tsx` logged-out + fetch-error both look like empty state. → **FIX:** add !hasToken gate + isError branch.
- **P2 · ux · MessagesDrawer mutations no onError** — `components/messaging/MessagesDrawer.tsx:267-284` failed send silently looks sent. → **FIX:** onError toast.
- **P2 · ux · no app/error.tsx / not-found.tsx / loading.tsx** — uncaught render or bad URL falls to Next default unstyled page, breaks dark theme. → **FIX:** add themed error + 404.
- **P3 · dead code + misc img onError + label-less inputs** — see review (OnboardingWizard dead StepShell blocks, CampaignModal unref, c/[slug] inputs no label, ConversationExtras `href="#"` dead tab).

**✅ Frontend review clean:** all `Link`/`router.push` targets resolve; loading/error/empty states near-universal; no redirect loops; a11y labels present; no stray localhost/vercel.app outside intended resolveApiUrl.

#### Findings — Pass 1 (live API fuzz, 180 endpoints, 4-token matrix)

- **P0 CONFIRMED (live PoC) · `PUT /uploads/r2/{object_key}` unauth arbitrary write** — no auth, no signature; presign returns an UNSIGNED url. PoC: PUT `Content-Type: image/svg+xml` with `<svg><script>` body → `GET` echoes it back verbatim same-origin as API = stored-XSS + can overwrite any live asset (brand logos/thumbnails whose keys are in public JSON). Same root cause as backend-review P0. → **FIX (Codex):** HMAC-signed+expiring presigned URL scoped to object_key, verify in PUT; normalize/whitelist Content-Type on write.
- **P2 · reliability · admin contract 500** — `GET`/`PUT /api/admin/campaigns/{id}/contract` return 500 (not 404) for a non-existent campaign_id. → **FIX:** 404 on missing campaign.
- _cleanup:_ fuzzer wrote 2 throwaway R2 test keys (no DELETE endpoint) — harmless junk objects; will be inert once presign requires a signature.

**✅ PASS (live fuzz corroborates code review):** 180/180 endpoints — **0 wrong-realm 2xx** (JWT `aud` realm-scoped + validated), **0 IDOR** (foreign real-prod submission/conversation/campaign IDs all 404), all JWT-robustness attacks (alg:none, expired, malformed, tampered, cross-realm refresh) rejected. The only cross-realm 200 is a static public dropdown list under /api/creator/* (non-sensitive).

**✅ Cross-checked clean by backend review:** SQL injection (all ORM/bound params), realm-scoping (all 25 routers use correct realm dep — corroborates my API matrix), IDOR on owned resources, payout logic (server-computed, row-locked, double-claim blocked), CORS allow-list, secrets (validate_for_runtime hard-fails weak JWT), stored-XSS (no untrusted dangerouslySetInnerHTML path).
