# Feature Backlog — SideShift-parity creator features

Captured from Bill's walkthroughs (screenshots referenced). All are "match how
SideShift does it, but for Lumina Creators."

---

## 1. Social handle verification (bio-code method) — IN PROGRESS
Verify Instagram + TikTok handles the way SideShift does.

**Flow:** creator enters handle → app issues a short code (`LC-XXXXXX`) → creator
pastes it into their platform bio → clicks **Verify** → app scrapes the bio via
Apify, matches the code, flips `is_verified` and pulls the real follower count.
Decision made: **bio-code for BOTH IG and TikTok** (no TikTok OAuth — avoids a
TikTok dev app + review).

**Built (backend, not yet deploy-applied):**
- `social_accounts.verification_code` + `verification_code_expires_at` (migration `0018`)
- `apify.scrape_profile()` (IG `apify~instagram-profile-scraper`, TikTok `clockworks~tiktok-profile-scraper`)
- `services/socials_verify.py` — `start_verification` / `confirm_verification` (+ dev auto-verify fallback when APIFY unset & non-prod)
- Endpoints `POST /api/creator/profile/socials/verify/{start,confirm}`

**Remaining:** apply migration (blocked — see Blockers), frontend verify UI in the
onboarding SocialStep + Account → Socials (get-code, copy, Verify button, verified badge).

## 2. Profile-completion gate on Join/Apply — BACKEND DONE
Clicking Join/Apply on a campaign must require a minimally complete profile; a
popup ("Complete your profile to apply") routes to the profile/onboarding page.

**Built:** `join_campaign` now raises `403 {code: profile_incomplete, missing:[…]}`
when the creator has no name or no social (`socials_verify.apply_eligibility`).
**Remaining:** frontend — catch the 403 in the join handler (CampaignModal +
campaign detail page), show the popup + "Complete Profile" button → `/onboarding`.
⚠️ Do NOT deploy the backend gate until the frontend popup ships, or live users
hit a raw error.

## 3. Experience section — TODO
Account → Experiences tab. "Add experience" opens a popup (blurred backdrop) with
three types:
- **Organic UGC**
- **UGC paid ad**
- **Professional role** → pick a job title:
  Content creator · Content strategist · Social media manager · Social media intern ·
  Campaign manager · Community manager · Influencer marketing manager · Brand ambassador · Other
→ next step asks for **company website** → **Review** screen ("This experience will
be automatically verified and visible on your profile") → **Add experience** →
shows as a card on the Experiences tab (e.g. "Lumina Clippers · Other" with a green
verified check). Auto-verified (no manual review).

**Needs:** `experiences` table (creator_id, type, role_title, company_url,
company_name?, verified default true, created_at), CRUD endpoints, Account
Experiences tab UI + the multi-step add popup.

## 4. Top Videos → Portfolio "Top Content" — TODO
Account → Top Videos tab. Two platform toggles (TikTok / Instagram) + a URL field;
paste a Reel/video link, click **+**, the video is added with its thumbnail +
view/like counts. Up to **3** videos. Shows on the Portfolio page as "Top Content".
**No ownership verification** — pasting the link is enough (Bill: "no verification
needed for the top video").

**Needs:** likely reuse `portfolio_items` (add platform + external video_url +
thumbnail + views/likes), a scrape-on-add for thumbnail/stats (reuse `apify.scrape_batch`
single-URL, or store link + lazy thumbnail), Top-Videos tab UI (max 3), and render
in Portfolio "Top Content".

---

## Blockers / risks
- **Alembic chain drift:** the DB in `backend/.env` (`dpg-d92v6…`) is stamped at
  `0007_suspicious_flag`, which no migration file defines → `alembic upgrade head`
  fails. That `.env` DB also returns 0 campaigns while the **live Render backend
  returns 4** → `backend/.env` is a *different/stale* DB than production. Need the
  correct prod `DATABASE_URL` and an alembic re-stamp before any migration (0018+)
  can apply.
- **Parallel harness:** another Claude Code harness is actively committing to this
  same repo/DB (today's commits). Two agents editing the same files/DB will
  conflict — decide who owns which features.
