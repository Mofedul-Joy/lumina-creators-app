# Lumina Creators App — Database Schema (v2, finalized)

> PostgreSQL (Render). **v2** incorporates the Codex adversarial review + Claude's finalization pass (see [`ARCHITECTURE_REVIEW.md`](./ARCHITECTURE_REVIEW.md) for the full decision record).
> This is the **finalized high-priority core**: auth (with durable refresh tokens), mandatory server-verified creator profiles, the filterable admin database, the campaign builder (both modes, soft-delete), submissions with earning snapshots, durable scraping, and a double-pay-safe payout model.
>
> **Conventions:** UUID PKs (`gen_random_uuid()`), `created_at`/`updated_at` on mutable rows (app- or trigger-maintained), `TIMESTAMPTZ` (UTC). **Money:** rates & live estimates at `NUMERIC(_,4)` precision; settled amounts rounded to `NUMERIC(_,2)`. Counts are `INTEGER`. Managed via Alembic — this DDL is intent; migrations are truth.
>
> **Extensions (baseline migration):** `pgcrypto` (`gen_random_uuid`), `citext` (case-insensitive email).

---

## Entity map

```
creators ──1:1── creator_profiles ──(avatar)──┐
   │  1:many ── social_accounts               ├──► storage_objects  ◄── portfolio_items
   │  1:many ── portfolio_items ──────────────┘                     ◄── submissions.proof
   │  1:many ── payment_methods
   │  1:many ── campaign_participations ──many:1── campaigns ──many:1── admins (created_by)
   │                    ▲ (composite FK)
   │  1:many ── submissions ──1:1── scrape_jobs
   │  1:many ── payouts ──1:many── payout_items ──(≤1 active)── submissions
   └  (refresh_tokens, audit_log reference subjects/actors)
```

**Design decisions baked into the model** (rationale in the review doc):
- **Two identity tables** (`creators`, `admins`) — the closed-marketplace audience boundary, clean and safe.
- **`campaign_mode` enum** (`create_new` | `copy_paste`) is the schema-level embodiment of the video's core split; `chk_mode_content` guarantees each campaign carries exactly the right content for its mode.
- **Demographic filter columns are first-class and indexed** — the exact fields Collabstr paywalls (age via DOB, gender, ethnicity, language) are native and fast here.
- **Financial integrity first:** rate/eligibility snapshots on submissions, soft-delete of campaigns, an **active-unique** payout item (`≤1 non-voided item per submission`) that makes double payment structurally impossible *while staying retryable*, and campaign `spent_amount` for budget enforcement.
- **Enum vs text:** stable domains are enums; **volatile domains stay `text`** (`ethnicity`, `audit_log.action`, `refresh_tokens.subject_type`) because Postgres enum values are painful to remove/reorder.

---

## Enums (stable domains only)

```sql
CREATE TYPE creator_status       AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE signup_source        AS ENUM ('self', 'admin_invite', 'migrated');
CREATE TYPE admin_role           AS ENUM ('owner', 'admin', 'staff');
CREATE TYPE client_status        AS ENUM ('active', 'suspended');   -- brand/client accounts (read-only dashboard)
CREATE TYPE gender               AS ENUM ('male', 'female', 'non_binary', 'other', 'prefer_not_to_say');
CREATE TYPE platform             AS ENUM ('instagram', 'tiktok', 'youtube', 'twitter', 'facebook');
CREATE TYPE campaign_mode        AS ENUM ('create_new', 'copy_paste');
CREATE TYPE campaign_status      AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');
CREATE TYPE participation_status AS ENUM ('joined', 'submitted', 'approved', 'rejected');
CREATE TYPE scrape_status        AS ENUM ('pending', 'success', 'failed');   -- submission's latest scrape outcome
CREATE TYPE scrape_job_status    AS ENUM ('queued', 'running', 'success', 'failed');
CREATE TYPE verification_status  AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE payout_method        AS ENUM ('paypal', 'solana', 'whop');
CREATE TYPE payout_status        AS ENUM ('requested', 'processing', 'paid', 'failed');
CREATE TYPE storage_purpose      AS ENUM ('avatar', 'portfolio_video', 'proof_video');
CREATE TYPE storage_status       AS ENUM ('pending', 'uploaded', 'finalized', 'rejected');
-- ethnicity, audit action, refresh subject_type intentionally stay TEXT (volatile domains).
```

---

## 1. `creators` — creator identity realm

```sql
CREATE TABLE creators (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          CITEXT UNIQUE NOT NULL,
  password_hash  TEXT,                              -- NULL only for admin_invite/migrated until first-login set-password
  status         creator_status NOT NULL DEFAULT 'pending',
  signup_source  signup_source  NOT NULL DEFAULT 'self',   -- resolves the signup ambiguity Codex flagged
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A self-signup creator must have a password; invited/migrated may set it on first login.
  CONSTRAINT chk_self_signup_has_password
    CHECK (signup_source <> 'self' OR password_hash IS NOT NULL)
);
```

## 2. `admins` — Lumina staff (admin identity realm)

```sql
CREATE TABLE admins (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          CITEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  role           admin_role NOT NULL DEFAULT 'admin',   -- payout processing gated to owner/admin in service
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 2b. `clients` — brand/client accounts (3rd identity realm; read-only)

A client is a brand Lumina does business with. They get a **view-only** dashboard scoped to the campaigns Lumina links to them. They cannot create/edit anything, see other clients' data, or reach creators.

```sql
CREATE TABLE clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         CITEXT UNIQUE NOT NULL,
  password_hash TEXT,                              -- set on first login (admin provisions the account)
  name          TEXT,                              -- display / brand contact name (e.g. "Caliante")
  status        client_status NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
Campaign linkage is via `campaigns.client_id` (see §7). A client's dashboard aggregates only their own campaigns' submissions; earnings/payouts/creator PII are never exposed to clients.

## 3. `storage_objects` — every uploaded file (presign → upload → finalize)

Referenced by avatars, portfolio videos, and proof videos. Server finalizes (validates type/size/scan) before an object may be attached.

```sql
CREATE TABLE storage_objects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,   -- NULL allowed for admin/system assets
  purpose          storage_purpose NOT NULL,
  bucket           TEXT NOT NULL,
  object_key       TEXT NOT NULL,
  content_type     TEXT,
  size_bytes       BIGINT,
  checksum_sha256  TEXT,
  status           storage_status NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at     TIMESTAMPTZ,
  UNIQUE (bucket, object_key)
);
CREATE INDEX idx_storage_owner  ON storage_objects(owner_creator_id);
CREATE INDEX idx_storage_status ON storage_objects(status);
```

## 4. `creator_profiles` — mandatory profile (1:1). Completion is server-owned.

`completed_at` is set **only** by the server's `recompute_profile_completion(creator_id)` routine (called on any profile/child mutation, with a DB trigger as backstop). It is never in a creator-writable schema. `completed_at IS NOT NULL` ⇔ complete ⇔ may enter campaigns.

```sql
CREATE TABLE creator_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID NOT NULL UNIQUE REFERENCES creators(id) ON DELETE CASCADE,
  display_name     TEXT,
  avatar_object_id UUID REFERENCES storage_objects(id),
  bio              TEXT,
  date_of_birth    DATE,                          -- age derived for filtering
  gender           gender,
  ethnicity        TEXT,                          -- volatile domain → TEXT (optionally FK to a lookup later)
  primary_language TEXT,
  languages        TEXT[] NOT NULL DEFAULT '{}',
  country          TEXT,
  city             TEXT,
  completed_at     TIMESTAMPTZ,                   -- server-owned completion marker (was: is_complete boolean)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Admin-database filter indexes (all core filters covered):
CREATE INDEX idx_profiles_gender     ON creator_profiles(gender);
CREATE INDEX idx_profiles_country    ON creator_profiles(country);
CREATE INDEX idx_profiles_city       ON creator_profiles(city);
CREATE INDEX idx_profiles_dob        ON creator_profiles(date_of_birth);
CREATE INDEX idx_profiles_ethnicity  ON creator_profiles(ethnicity);
CREATE INDEX idx_profiles_language   ON creator_profiles(primary_language);
CREATE INDEX idx_profiles_languages  ON creator_profiles USING GIN (languages);
CREATE INDEX idx_profiles_completed  ON creator_profiles(completed_at);
```

**Completion policy (enforced in `recompute_profile_completion`):** requires `display_name`, `date_of_birth`, `gender`, `primary_language`, `country`, **≥1 `social_accounts` row with a follower count**, and **≥1 finalized `portfolio_items` row**. Avatar recommended, not strictly required (tunable).

## 5. `social_accounts` — handles + follower counts (1:many)

```sql
CREATE TABLE social_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id     UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  platform       platform NOT NULL,
  handle         TEXT NOT NULL,
  profile_url    TEXT,
  follower_count INTEGER NOT NULL DEFAULT 0 CHECK (follower_count >= 0),
  is_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (creator_id, platform, handle)
);
CREATE INDEX idx_social_creator          ON social_accounts(creator_id);
CREATE INDEX idx_social_platform_follows ON social_accounts(platform, follower_count);  -- admin "platform + min followers" filter
```

## 6. `portfolio_items` — previous brand videos (1:many)

```sql
CREATE TABLE portfolio_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id        UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  storage_object_id UUID NOT NULL REFERENCES storage_objects(id),   -- finalized video object
  thumbnail_url     TEXT,
  brand_name        TEXT,
  caption           TEXT,
  platform          platform,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_portfolio_creator ON portfolio_items(creator_id);
```

## 7. `campaigns` — campaign engine (admin-created, both modes, soft-delete)

```sql
CREATE TABLE campaigns (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by             UUID NOT NULL REFERENCES admins(id),
  client_id              UUID REFERENCES clients(id),   -- brand this campaign belongs to (nullable; drives the client dashboard)
  name                   TEXT NOT NULL,
  slug                   TEXT UNIQUE NOT NULL,
  description            TEXT,
  mode                   campaign_mode NOT NULL,
  status                 campaign_status NOT NULL DEFAULT 'draft',

  -- economics (positive-checked; rates at 4dp, money at 2dp)
  cpm_rate               NUMERIC(12,4) NOT NULL CHECK (cpm_rate > 0),           -- $ per 1,000 views
  budget                 NUMERIC(14,2) NOT NULL CHECK (budget > 0),
  max_payout_per_creator NUMERIC(14,2)          CHECK (max_payout_per_creator IS NULL OR max_payout_per_creator > 0),
  eligible_view_pct      NUMERIC(5,2)  NOT NULL DEFAULT 100 CHECK (eligible_view_pct BETWEEN 0 AND 100),
  min_retention_days     INTEGER NOT NULL DEFAULT 30 CHECK (min_retention_days >= 0),
  spent_amount           NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (spent_amount >= 0),  -- finalized payable to date (budget guard)

  -- targeting
  platforms              platform[] NOT NULL DEFAULT '{}',
  geo_countries          TEXT[] NOT NULL DEFAULT '{}',   -- empty = worldwide

  -- mode-specific content
  brief_script           TEXT,          -- create_new: the script/instructions to film
  content_drive_url      TEXT,          -- copy_paste: Google Drive folder of approved clips
  caption_rules          TEXT,
  required_mentions      TEXT[] NOT NULL DEFAULT '{}',
  example_captions       TEXT[] NOT NULL DEFAULT '{}',
  requirements_url       TEXT,

  -- brand identity: creator-VISIBLE on campaign cards (brands are not users; their NAME is still shown)
  brand_name             TEXT,
  brand_logo_url         TEXT,

  starts_at              TIMESTAMPTZ,
  ends_at                TIMESTAMPTZ,
  published_at           TIMESTAMPTZ,
  archived_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- exactly the right content for the mode; no empty strings; no cross-mode leakage
  CONSTRAINT chk_mode_content CHECK (
    (mode = 'create_new' AND brief_script      IS NOT NULL AND btrim(brief_script)      <> '' AND content_drive_url IS NULL) OR
    (mode = 'copy_paste' AND content_drive_url IS NOT NULL AND btrim(content_drive_url) <> '')
  ),
  CONSTRAINT chk_dates CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at),
  -- publish-gating: anything past draft must have ≥1 platform (drafts may be incomplete)
  CONSTRAINT chk_platforms_when_live CHECK (status = 'draft' OR array_length(platforms, 1) >= 1)
);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_mode   ON campaigns(mode);
CREATE INDEX idx_campaigns_client ON campaigns(client_id);   -- client dashboard scoping
```

> **Deletion = archive.** Admin "delete" sets `status='archived'`, `archived_at=now()`. There is **no hard delete** and **no cascade** from campaigns into participations/submissions (they carry financial history). Enforced by `ON DELETE RESTRICT` below.

## 8. `campaign_participations` — creator enters a campaign

```sql
CREATE TABLE campaign_participations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  creator_id  UUID NOT NULL REFERENCES creators(id)  ON DELETE RESTRICT,
  status      participation_status NOT NULL DEFAULT 'joined',
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, creator_id),
  UNIQUE (id, campaign_id, creator_id)          -- supports the composite FK from submissions
);
CREATE INDEX idx_part_campaign ON campaign_participations(campaign_id);
CREATE INDEX idx_part_creator  ON campaign_participations(creator_id);
```

## 9. `submissions` — posted clips, metric + earning snapshots

Every submission is tied to a participation (a creator can't submit to a campaign they didn't join), carries the **rate it was priced at**, and dedups on a **canonical URL hash**.

```sql
CREATE TABLE submissions (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id           UUID NOT NULL,
  campaign_id                UUID NOT NULL,
  creator_id                 UUID NOT NULL,

  post_url                   TEXT NOT NULL,            -- raw as submitted
  canonical_url              TEXT NOT NULL,            -- normalized (strip params, x.com→twitter.com, trailing slash)
  url_hash                   TEXT NOT NULL,            -- sha256(canonical_url)
  platform                   platform NOT NULL,        -- service enforces platform = ANY(campaign.platforms)

  views                      INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  likes                      INTEGER NOT NULL DEFAULT 0 CHECK (likes >= 0),
  comments                   INTEGER NOT NULL DEFAULT 0 CHECK (comments >= 0),

  -- pricing snapshots (immutable once set; protect earnings from later campaign edits)
  cpm_rate_snapshot          NUMERIC(12,4) NOT NULL,
  eligible_view_pct_snapshot NUMERIC(5,2)  NOT NULL DEFAULT 100,

  estimated_amount           NUMERIC(14,4) NOT NULL DEFAULT 0,   -- live, recomputed each scrape (high precision)
  payable_amount             NUMERIC(12,2),                      -- finalized & rounded; NULL until finalized
  finalized_at               TIMESTAMPTZ,

  scrape_status              scrape_status NOT NULL DEFAULT 'pending',
  verification_status        verification_status NOT NULL DEFAULT 'pending',
  verification_note          TEXT,
  verified_by                UUID REFERENCES admins(id),
  verified_at                TIMESTAMPTZ,
  proof_object_id            UUID REFERENCES storage_objects(id),   -- required for create_new; optional for copy_paste

  embed_broken               BOOLEAN NOT NULL DEFAULT FALSE,        -- live but un-embeddable (geo etc.)
  post_unavailable           BOOLEAN NOT NULL DEFAULT FALSE,        -- deleted/private/removed
  thumbnail_url              TEXT,

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_scraped_at            TIMESTAMPTZ,

  UNIQUE (campaign_id, url_hash),                        -- robust dedup (beats tracking params / x.com aliases)
  FOREIGN KEY (participation_id, campaign_id, creator_id)
    REFERENCES campaign_participations(id, campaign_id, creator_id) ON DELETE RESTRICT
);
CREATE INDEX idx_sub_creator ON submissions(creator_id);
CREATE INDEX idx_sub_campaign ON submissions(campaign_id);
CREATE INDEX idx_sub_scrape  ON submissions(scrape_status);
CREATE INDEX idx_sub_verify  ON submissions(verification_status);
```

## 10. `scrape_jobs` — durable scrape queue (1:1 with submission)

Replaces in-request `BackgroundTasks`. A Render cron worker pulls due jobs (`status IN ('queued','failed') AND next_run_at <= now()`), runs Apify idempotently, records the run id, and reschedules re-scrapes until the campaign's retention window ends.

```sql
CREATE TABLE scrape_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     UUID NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  status            scrape_job_status NOT NULL DEFAULT 'queued',
  attempts          INTEGER NOT NULL DEFAULT 0,
  max_attempts      INTEGER NOT NULL DEFAULT 5,
  last_apify_run_id TEXT,
  last_error        TEXT,
  next_run_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scrape_due ON scrape_jobs(status, next_run_at);
```

## 11. `payment_methods` — how a creator gets paid (provider-consistent)

```sql
CREATE TABLE payment_methods (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id     UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  method         payout_method NOT NULL,
  paypal_email   TEXT,
  solana_address TEXT,
  whop_username  TEXT,
  is_default     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- exactly the fields for the chosen provider, nothing else
  CONSTRAINT chk_method_fields CHECK (
    (method = 'paypal' AND paypal_email   IS NOT NULL AND solana_address IS NULL AND whop_username IS NULL) OR
    (method = 'solana' AND solana_address IS NOT NULL AND paypal_email   IS NULL AND whop_username IS NULL) OR
    (method = 'whop'   AND whop_username  IS NOT NULL AND paypal_email   IS NULL AND solana_address IS NULL)
  )
);
CREATE UNIQUE INDEX uq_default_method_per_creator ON payment_methods(creator_id) WHERE is_default;
```

## 12. `payouts` + `payout_items` — money out, double-pay-safe **and** retryable

Double-pay guard = **at most one _active_ (non-voided) payout_item per submission** (a partial unique index), **not** a global unique. When a transfer fails, its items are **voided**, which releases the submissions so a new payout can settle them — without ever allowing two *active* claims on the same earning. Retries are made safe against provider-side double-sends by a per-payout `idempotency_key`.

```sql
CREATE TABLE payouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      UUID NOT NULL REFERENCES creators(id) ON DELETE RESTRICT,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),   -- == SUM(active payout_items.amount)
  method          payout_method NOT NULL,
  status          payout_status NOT NULL DEFAULT 'requested',  -- requested → processing → paid | failed
  idempotency_key UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),  -- sent to provider; makes retries idempotent
  processed_by    UUID REFERENCES admins(id),
  external_ref    TEXT,                                        -- provider tx id (reconcile against this before retry)
  failure_reason  TEXT,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payouts_creator ON payouts(creator_id);
CREATE INDEX idx_payouts_status  ON payouts(status);

CREATE TABLE payout_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id     UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  voided_at     TIMESTAMPTZ,                          -- set when the owning payout fails → releases the submission
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The double-pay guard: a submission may have at most ONE active (non-voided) item.
CREATE UNIQUE INDEX uq_active_payout_item ON payout_items(submission_id) WHERE voided_at IS NULL;
CREATE INDEX idx_payout_items_payout ON payout_items(payout_id);
```

## 13. `refresh_tokens` — rotating refresh (promoted from secondary; auth needs it)

```sql
CREATE TABLE refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   UUID NOT NULL,                 -- creator.id or admin.id
  subject_type TEXT NOT NULL,                 -- 'creator' | 'admin' (TEXT: volatile-ish, avoids enum churn)
  jti          UUID NOT NULL UNIQUE,
  token_hash   TEXT NOT NULL,                 -- store a hash, never the raw token
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  user_agent   TEXT,
  ip           INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_subject ON refresh_tokens(subject_type, subject_id);
CREATE INDEX idx_refresh_expiry  ON refresh_tokens(expires_at);
```

## 14. `audit_log` — admin actions (financial + trust events)

```sql
CREATE TABLE audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_admin_id UUID REFERENCES admins(id),
  action         TEXT NOT NULL,                 -- 'campaign.publish' | 'campaign.archive' | 'submission.verify' | 'payout.process' | 'creator.suspend' | …
  entity_type    TEXT NOT NULL,
  entity_id      UUID,
  metadata       JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_actor  ON audit_log(actor_admin_id);
```

---

## Money & budget flow (finalized, race-safe)

```
On submit:
  submission.cpm_rate_snapshot          = campaign.cpm_rate
  submission.eligible_view_pct_snapshot = campaign.eligible_view_pct
  enqueue scrape_job(submission)

On each scrape (worker):
  update views/likes/comments, last_scraped_at
  estimated_amount = views/1000.0 * cpm_rate_snapshot * eligible_view_pct_snapshot/100   -- NUMERIC(_,4), display only
  reschedule next_run_at while now() < campaign.ends_at + min_retention_days (else stop)

On finalize (submission verified AND retention met / campaign completed) — single transaction:
  SELECT ... FROM campaigns WHERE id = :cid FOR UPDATE            -- lock the campaign row
  amount = round(estimated_amount, 2)
  amount = LEAST(amount, budget - spent_amount)                  -- never exceed campaign budget
  amount = LEAST(amount, max_payout_per_creator - creator_paid_in_campaign)  -- per-creator cap (if set)
  submission.payable_amount = amount ; submission.finalized_at = now()
  campaigns.spent_amount   += amount

On payout (admin batch):
  create payout(creator, method, idempotency_key); status='requested'
  for each finalized submission with NO active payout_item:
     insert payout_item(payout_id, submission_id, amount = submission.payable_amount)  -- partial-unique blocks a 2nd active claim
  payout.amount = SUM(active items); status='processing'
  call provider WITH idempotency_key (provider dedups a re-send of the same key)
  ├─ success  → status='paid', paid_at=now(), external_ref=<tx>
  └─ failure  → RECONCILE first: query provider by idempotency_key/external_ref.
                • provider says paid → treat as success (do NOT void)
                • provider says not paid → status='failed', failure_reason set,
                  void all items (voided_at=now()) → submissions released for a new batch

Retry after a failed payout: build a NEW payout (new idempotency_key) over the released
submissions. The voided old items stay for audit; only the new active items can settle.
```

`pending_earnings = Σ payable_amount for finalized submissions with NO active payout_item`
(so a failed/voided payout correctly returns them to pending). `total_paid = Σ payouts.amount WHERE status='paid'`.

---

## Deferred (explicitly NOT in the high-priority core — avoid premature complexity)

- `campaign_platforms` (per-platform rates/eligibility) — **only if** a campaign ever needs different CPM per platform. Today CPM is single-rate; keep `platforms platform[]`.
- `campaign_assets` (normalized store of a campaign's clips) — **only if** copy_paste content outgrows a single `content_drive_url`.
- `creator_search` materialized view — indexes handle thousands of creators; revisit at scale.
- `scrape_runs` per-run history — one `scrape_jobs` row with retry fields suffices; add history only if audit demands it.
- Separate `earnings`/`submission_earnings` ledger — unnecessary for pay-once-per-submission; the active-unique `payout_items` guard already prevents double payment while allowing retries. Add a ledger only if Lumina moves to **incremental** payouts as views grow.
- `email_codes` (email-code login fallback), `notifications`, admin **MFA**, encrypted-at-rest payout fields — post-core hardening.
```
