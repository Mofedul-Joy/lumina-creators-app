# Architecture Review & Finalization — Decision Record

> How the v1 architecture became v2. Two passes: **(A)** an independent Codex (GPT-5.x) adversarial review of Claude's v1 `ARCHITECTURE.md` + `SCHEMA.md`, then **(B)** Claude's finalization — adjudicating each Codex finding, adversarially reviewing Codex's *own* proposals, and applying the fixes. v1 remains the trusted base; v2 is its hardened evolution.
>
> Legend: ✅ accepted · 🔁 accepted-but-modified · ❌ rejected/deferred.

---

## A. Codex findings → verdicts

### Ambiguities / contradictions
| # | Codex finding | Verdict | What we did |
|---|---|---|---|
| A1 | v1 forbids public campaign data (CONTEXT) but allows "optional public campaign browse" (ARCHITECTURE). | ✅ | Public router is **health-only**. Removed any public campaign browse/submit. Closed model + profile gate now consistent. |
| A2 | Creator signup ambiguous — `password_hash` nullable resembles the old admin-created clipper flow. | 🔁 | Added `creators.signup_source ('self'\|'admin_invite'\|'migrated')` + `chk_self_signup_has_password`. Self-signup is primary and **must** have a password; nullable hash exists only for invited/migrated creators. |
| A3 | `brand_name/brand_logo_url` labeled "internal only," but creator cards need campaign identity. | ✅ | Relabeled **creator-visible**. "Closed" means brands aren't *users*, not that their name is hidden (the video's cards show VIBECON/Midjourney logos). |

### Data-model / correctness bugs in Claude's v1
| # | Codex finding | Verdict | Fix in v2 |
|---|---|---|---|
| B1 | `creator_profiles.is_complete` as a plain writable boolean is spoofable / can drift. | ✅ | Replaced with server-owned `completed_at`, set only by `recompute_profile_completion()`; explicit completion policy documented. |
| B2 | Hard campaign delete cascades destroy financial history (`submissions`, `participations` `ON DELETE CASCADE`). | ✅ | **Soft-delete**: `status='archived'` + `archived_at`; financial tables are `ON DELETE RESTRICT`. No cascade over money. |
| B3 | `payouts.submission_ids UUID[]` — no FK, no per-item amount, no uniqueness → can double-pay. | 🔁 | Replaced with `payout_items` (FK + per-item amount) instead of Codex's separate ledger — **one fewer table** for a pay-once model. (The uniqueness guard was first a global unique, then refined to **active-unique** in D1 to keep retries safe.) |
| B4 | Submissions can bypass participation (no `participation_id`). | 🔁 | Added `participation_id` **plus a composite FK** `(participation_id, campaign_id, creator_id)` → `campaign_participations`, guaranteeing consistency without a trigger. |
| B5 | Weak URL dedup — `UNIQUE(campaign_id, post_url)` beaten by tracking params, `x.com`↔`twitter.com`, trailing slashes. | ✅ | Store `canonical_url` + `url_hash` (sha256); `UNIQUE(campaign_id, url_hash)`. |
| B6 | Missing rate snapshot — editing a campaign's CPM later rewrites past earnings. | ✅ | Added `cpm_rate_snapshot` + `eligible_view_pct_snapshot` on `submissions`, set at submit time. |
| B7 | Money under-specified — `NUMERIC(12,2)` + `views/1000*cpm` causes rounding disputes. | ✅ | Estimates at `NUMERIC(_,4)`, rates at 4dp; round to 2dp only at finalize/settle. |
| B8 | No budget-race protection — concurrent scrapes/payouts can exceed `budget`/`max_payout_per_creator`. | ✅ | Added `campaigns.spent_amount`; finalization runs in a txn with `SELECT … FOR UPDATE` and caps against budget + per-creator max. |
| B9 | Campaign constraints too weak — no positive checks, no date order, empty `platforms` can publish, `chk_mode_content` allows empty strings / cross-mode fields. | ✅ | Added `CHECK`s: positive `cpm_rate/budget/max_payout`, `starts_at<ends_at`, non-empty platforms once past draft, tightened `chk_mode_content` (non-empty + no cross-mode leakage). |
| B10 | Payment methods allow inconsistent provider fields (e.g. paypal with null email). | ✅ | Added `chk_method_fields` — exactly the chosen provider's field set, nothing else. |
| B11 | `BackgroundTasks` for scraping isn't durable (lost jobs, dup Apify runs, no retry). | ✅ | `scrape_jobs` table + Render cron worker; idempotent via `last_apify_run_id`, retries via `attempts`/`next_run_at`. |
| B12 | Scraping state too thin (no attempts, provider errors, run IDs, retry). | 🔁 | Captured on `scrape_jobs`. Kept it to **one** table (dropped Codex's separate `scrape_runs` history as premature). |
| B13 | Rotating refresh specified in prose but `refresh_tokens` deferred as secondary. | ✅ | Promoted `refresh_tokens` into the core schema (jti, hashed token, rotation, revoke). |
| B14 | URL-only upload fields can't track ownership/type/size/scan/finalize. | ✅ | Added `storage_objects` (presign→upload→finalize); profile/portfolio/proof reference finalized objects. |
| B15 | Admin-database filters lack indexes (ethnicity, language, city, follower_count, platform). | ✅ | Added all of them, incl. `social_accounts(platform, follower_count)` composite for "platform + min followers." |
| B16 | No admin audit logging for money/trust events. | ✅ | Added `audit_log` (publish/archive/verify/payout/suspend). |

---

## B. Issues found in **Codex's own** proposals (Claude's adversarial pass)

The user asked to bug-hunt Codex too, not rubber-stamp it. Where Codex over-built or under-specified:

| # | Codex proposed | Problem | Decision |
|---|---|---|---|
| C1 | A full `earnings`/`submission_earnings` **ledger** with `UNIQUE(earning_id)` on payout items. | Redundant for Lumina's **pay-once-per-submission** model — an extra table and join for no added safety. | ❌ Deferred. Active-unique `payout_items` (D1) gives identical double-pay protection with retryability. A ledger is only warranted if payouts become **incremental** as views grow — noted as an open question. *(Caveat: over-simplifying here first caused the D1 stranding bug; the active-unique guard is the correct minimal form.)* |
| C2 | **Two** scrape tables (`scrape_jobs` **and** `scrape_runs`). | Per-run history is audit gold-plating at MVP; doubles write volume and complexity. | ❌ Collapsed to one `scrape_jobs` row with retry fields; history deferred. |
| C3 | `campaign_platforms` normalization. | No per-platform rate exists in the product (single CPM per campaign, per the video). Normalizing now adds joins for nothing. | ❌ Deferred; keep `platforms platform[]`, enforce `submission.platform ∈ campaign.platforms` in service. |
| C4 | Denormalized `creator_search` materialized view. | Premature — proper indexes serve thousands of creators fine; an MV adds refresh/staleness complexity. | ❌ Deferred to "at scale." |
| C5 | Admin **MFA** + rich permission matrix. | Over-built for a 1–3 person internal admin team at MVP. | 🔁 Kept lightweight `admins.role` + `is_active` gating; MFA deferred. |
| C6 | "Encrypt sensitive payment fields." | Reasonable long-term, but PayPal email / Solana address aren't high-secrecy and encryption complicates lookups now. | 🔁 Constraint-validated now; at-rest encryption deferred to hardening. |
| C7 | `eligible_view_pct` per submission, source unspecified. | Ambiguous where the % comes from. | 🔁 Modeled as a **campaign-level** setting (default 100) **snapshotted** onto the submission; flagged as an open question for Rhys. |

### Things **both** missed (Claude added)
- **Postgres enum-evolution caveat** — volatile domains (`ethnicity`, `audit_log.action`, `refresh_tokens.subject_type`) kept as `TEXT`, since removing/reordering enum values is painful in Postgres. Stable domains stay enums.
- **`create_new` vs `copy_paste` verification asymmetry** — proof video required for `create_new`, optional for `copy_paste` (a repost). Documented in the completion/verification flow.
- **Composite-FK integrity** (B4) instead of a trigger — cheaper and always-correct.

### D. Post-finalization fix (Codex stop-time review)
| # | Finding | Verdict | Fix |
|---|---|---|---|
| D1 | The v2 double-pay guard (`payout_items.submission_id` **globally UNIQUE**) **stranded finalized earnings after a failed transfer**: a submission locked into a failed payout could never be re-added to a retry (UNIQUE violation) → unpayable. Ironically, simplifying away Codex's ledger (C1) reintroduced the retry gap the ledger's state machine would have covered. | ✅ | Guard changed to **at most one _active_ item** via `CREATE UNIQUE INDEX … WHERE voided_at IS NULL`. Failed payouts **void** their items (releasing submissions to pending); retries build a fresh payout. Added `payouts.idempotency_key` + a **reconcile-before-fail** step so a timed-out-but-succeeded provider transfer can't become a double send. Double-pay safety preserved, stranding eliminated. |

---

## C. Net result

v2 keeps 100% of v1's shape (monorepo, audience-first routers, two JWT realms, `campaign_mode`, R2 presign, Apify, admin-only campaigns) and hardens the parts that touch **money, trust, and durability**. New/changed tables vs v1: `storage_objects`, `scrape_jobs`, `refresh_tokens`, `audit_log`, `payout_items` (replacing the `UUID[]`), plus snapshot/constraint columns on `submissions` and `campaigns`. Deliberately **not** added: `earnings` ledger, `scrape_runs`, `campaign_platforms`, `creator_search` MV, MFA — so the core stays lean.

Open questions that remain genuinely Rhys's call are consolidated in `CONTEXT.md §7`.
