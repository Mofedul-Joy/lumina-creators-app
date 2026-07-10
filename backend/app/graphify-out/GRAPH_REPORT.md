# Graph Report - lumina-creators-app/backend/app  (2026-07-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 884 nodes · 1977 edges · 45 communities
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 301 edges (avg confidence: 0.61)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `21e1b6f7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]

## God Nodes (most connected - your core abstractions)
1. `FastAPI` - 43 edges
2. `get_settings()` - 35 edges
3. `Base` - 23 edges
4. `TimestampMixin` - 19 edges
5. `LoginIn` - 18 edges
6. `RefreshIn` - 18 edges
7. `Admin` - 17 edges
8. `Session` - 17 edges
9. `Session` - 17 edges
10. `UUID` - 16 edges

## Surprising Connections (you probably didn't know these)
- `health()` --calls--> `get_settings()`  [INFERRED]
  routers/public/health.py → core/config.py
- `_share_url()` --calls--> `get_settings()`  [INFERRED]
  routers/admin/campaigns.py → core/config.py
- `settings()` --calls--> `get_settings()`  [INFERRED]
  routers/admin/settings.py → core/config.py
- `get_engine()` --calls--> `get_settings()`  [INFERRED]
  db/session.py → core/config.py
- `poll_run()` --calls--> `get_settings()`  [INFERRED]
  integrations/apify.py → core/config.py

## Import Cycles
- 1-file cycle: `main.py -> main.py`
- 1-file cycle: `core/security.py -> core/security.py`
- 1-file cycle: `routers/admin/applicants.py -> routers/admin/applicants.py`
- 1-file cycle: `services/payouts.py -> services/payouts.py`
- 1-file cycle: `services/payouts_v2.py -> services/payouts_v2.py`
- 1-file cycle: `services/socials_verify.py -> services/socials_verify.py`
- 1-file cycle: `services/gamification.py -> services/gamification.py`
- 1-file cycle: `services/scrape_worker.py -> services/scrape_worker.py`

## Communities (45 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (46): Base, SQLAlchemy declarative base + shared column mixins., Base class for all ORM models., TimestampMixin, DeclarativeBase, Campaign, CampaignBonusMilestone, CampaignParticipation (+38 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (35): ClientListItem, list_clients(), Admin: list client (brand) accounts — powers the campaign builder's client picke, Admin realm router. All routes here will depend on get_current_admin., PlatformSettings, Admin settings: a read-only view of the deployed platform configuration.  These, settings(), Client (brand) realm router — READ-ONLY. All routes depend on get_current_client (+27 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (39): The wallet ledger — one row per deposit/withdrawal/payout/refund/     adjustment, WalletTransaction, _already_paid_for_participation(), _approved_submission_count(), _avatar_url(), compute_owed_all(), compute_owed_for_creator(), compute_owed_for_participation() (+31 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (35): login(), me(), Admin auth: password login, refresh, me. Admins are provisioned, not self-signup, refresh(), login(), me(), Client (brand) auth: password login, refresh, me. Read-only realm; no signup., refresh() (+27 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (34): _aggregate_stats(), bump_streak_on_submission(), compute_awards(), compute_rank(), compute_xp(), get_creator_gamification(), next_rank_info(), CreatorProfile (+26 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (33): archive(), campaign_out(), close(), create(), disable_share(), enable_share(), export_submissions_csv(), get_one() (+25 more)

### Community 6 - "Community 6"
Cohesion: 0.16
Nodes (31): CampaignBonusMilestone, archive_campaign(), _check_mode_content(), close_campaign(), create_campaign(), creator_has_joined(), get_active_campaign(), get_bonus_milestones() (+23 more)

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (29): _age(), applicant_detail(), _avatar_url(), _base_query(), counts(), export_csv(), list_applicants(), _now() (+21 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (29): add_portfolio(), add_social(), _avatar_url(), completion(), confirm_social_verify(), delete_portfolio(), delete_social(), get_profile() (+21 more)

### Community 9 - "Community 9"
Cohesion: 0.16
Nodes (26): creator_detail(), creator_rich_detail(), flag_suspicious(), list_creators(), Admin creator database: filterable list + drill-down profile. Admin-only., SideShift-style rich detail card (Feature 2) — superset of `creator_detail`, Admin-triggered write-back (Feature 7): recompute rank/xp/awards for one     cre, Admin-triggered bulk write-back (Feature 7): recompute rank/xp/awards     for ev (+18 more)

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (28): ApifyNotConfigured, fetch_dataset(), _item_stats(), _item_thumbnail(), _item_url(), match_dataset(), _nn(), _parse_profile() (+20 more)

### Community 11 - "Community 11"
Cohesion: 0.25
Nodes (26): AddFundsIn, forecast(), history(), ledger(), manual(), owed(), owed_v2(), pay_all() (+18 more)

### Community 12 - "Community 12"
Cohesion: 0.19
Nodes (26): hash_token(), Refresh tokens are stored as a sha256 hash, never in the clear., verify_password(), admin_login(), client_login(), _code_recently_sent(), creator_check_email(), creator_login() (+18 more)

### Community 13 - "Community 13"
Cohesion: 0.27
Nodes (23): counts(), delete(), flag_suspicious(), list_submissions(), log_payout(), LogPayoutIn, _proof_url(), Admin submission review: list, verify, reject. Admin-only. (+15 more)

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (21): get_settings(), Transactional email. Prefers Resend (HTTP — works from cloud hosts that block ou, _send_resend(), send_verification_code(), _client(), get_r2_object(), head_object(), is_local_mode() (+13 more)

### Community 15 - "Community 15"
Cohesion: 0.16
Nodes (20): browse(), detail(), join(), mine(), _public_out(), Creator-facing campaign browse + detail + join. Active campaigns only., Campaigns the creator applied to / joined, with their application status., browse() (+12 more)

### Community 16 - "Community 16"
Cohesion: 0.21
Nodes (21): ScrapedStats, ScrapeJob, _apply_stats(), _apply_zero_item_fallback(), _backoff(), compute_estimated_amount(), _due_jobs(), _is_paid() (+13 more)

### Community 17 - "Community 17"
Cohesion: 0.25
Nodes (20): brand_detail(), BrandCampaign, BrandDetail, create_user(), CreateUserIn, edit_client(), EditClientIn, list_users() (+12 more)

### Community 18 - "Community 18"
Cohesion: 0.26
Nodes (19): PortfolioItem, add_portfolio(), add_social(), delete_portfolio(), delete_social(), get_or_create_profile(), list_portfolio(), list_socials() (+11 more)

### Community 19 - "Community 19"
Cohesion: 0.17
Nodes (20): _bare_host(), canonicalize_url(), _demo(), detect_platform(), instagram_shortcode(), is_video_url(), match_key(), Submission URL canonicalization + hashing (the dedup rule from SCHEMA.md).  Beat (+12 more)

### Community 20 - "Community 20"
Cohesion: 0.23
Nodes (18): counts_by_status(), delete_submission(), _get(), _has_active_payout(), lifecycle_status(), list_submissions(), paid_submission_ids(), Session (+10 more)

### Community 21 - "Community 21"
Cohesion: 0.27
Nodes (17): attach_proof(), claim(), detail(), list_mine(), _out(), _out_one(), _paid_ids(), Creator submissions: submit a posted URL, list, detail, claim payout. (+9 more)

### Community 22 - "Community 22"
Cohesion: 0.25
Nodes (16): PayoutItem, _active_items_subq(), amounts_owed(), list_payouts(), log_manual_payment(), Decimal, Payout, Session (+8 more)

### Community 23 - "Community 23"
Cohesion: 0.23
Nodes (15): BaseModel, AddFundsIn, ForecastRow, LedgerRow, ManualPaymentIn, OwedBreakdown, OwedRow, OwedRowV2 (+7 more)

### Community 24 - "Community 24"
Cohesion: 0.14
Nodes (12): Fail fast on misconfiguration that is dangerous in production.          Called o, get_db(), get_engine(), Session, Database engine + session dependency.  The engine is created lazily so the app c, FastAPI dependency yielding a DB session., Engine, health() (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.25
Nodes (14): _age(), _avatar_urls(), _dob_bounds(), get_creator_detail(), get_creator_rich_detail(), list_creators(), Creator, Session (+6 more)

### Community 26 - "Community 26"
Cohesion: 0.27
Nodes (13): _campaign_out(), campaign_submissions(), ClientCampaignOut, ClientSubmissionOut, export_submissions_csv(), list_mine(), Client (brand) read-only dashboard: their campaigns with aggregated performance,, Same PII-free field set as the dashboard's submission table — no     creator ide (+5 more)

### Community 27 - "Community 27"
Cohesion: 0.21
Nodes (11): finalize(), presign(), Creator uploads: presign (start) + finalize (confirm). Self-scoped., PresignIn, Creator, Session, UUID, PresignIn (+3 more)

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (12): CheckEmailOut, CreatorLoginOut, LoginIn, Auth request/response schemas. Email kept as str (no email-validator dep — ponyt, Password login may report that the account exists but has no password yet., RefreshIn, ResendCodeIn, ResendOut (+4 more)

### Community 29 - "Community 29"
Cohesion: 0.26
Nodes (11): FileResponse, get_local(), get_r2(), _guard_local_mode(), _guard_proxy_mode(), put_local(), put_r2(), Public upload targets that stand in for direct-to-R2 presigned PUTs.  Two modes, (+3 more)

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (11): BonusMilestoneIn, CampaignCreateIn, CampaignOut, CampaignPublicOut, CampaignUpdateIn, MyCampaignOut, ParticipationOut, Campaign schemas. Money as Decimal (never float). Optional/List for 3.9 Pydantic (+3 more)

### Community 31 - "Community 31"
Cohesion: 0.29
Nodes (10): AdminAnalytics, analytics(), DayPoint, Kpis, PlatformStat, Admin analytics — network-wide performance for the owner's overview.  All derive, TopCampaign, TopCreator (+2 more)

### Community 32 - "Community 32"
Cohesion: 0.27
Nodes (10): create_access_token(), create_impersonation_token(), create_refresh_token(), decode_token(), _now(), datetime, Password hashing + JWT (HS256) with realm-scoped audience and rotating refresh., Short-lived client-audience access token minted for an admin's 'View as     Clie (+2 more)

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (10): CompletionOut, PortfolioIn, PortfolioOut, ProfileIn, ProfileOut, Creator profile schemas. Optional/List (not `X | None`) so Pydantic evals on 3.9, SocialIn, SocialOut (+2 more)

### Community 34 - "Community 34"
Cohesion: 0.38
Nodes (9): _check_one(), embed_check_batch(), embed_check_one(), EmbedCheckResult, Manual embed-health re-checks. Admin-only.  Separate from the scrape worker: thi, Admin, Session, Submission (+1 more)

### Community 35 - "Community 35"
Cohesion: 0.33
Nodes (9): finalize(), ImagePresignIn, ImagePresignOut, ImageUploadOut, presign(), Admin image uploads (campaign banners/thumbnails). presign -> PUT -> finalize, r, Admin, Session (+1 more)

### Community 36 - "Community 36"
Cohesion: 0.20
Nodes (3): BaseSettings, Application settings, loaded from environment / .env., Settings

### Community 37 - "Community 37"
Cohesion: 0.33
Nodes (9): _get_or_create_creator(), _get_or_create_profile(), _norm(), Creator, Session, Submission, UUID, Public (no-auth) campaign submission — the creator-acquisition funnel.  A strang (+1 more)

### Community 38 - "Community 38"
Cohesion: 0.42
Nodes (8): EmbedFlags, _flags(), probe(), _probe_2way(), _probe_instagram(), Probe whether a submitted post is still embeddable, using each platform's public, Returns None when the probe is indeterminate — caller should leave     existing, Verdict

### Community 39 - "Community 39"
Cohesion: 0.38
Nodes (6): AdminStats, Admin dashboard aggregate stats — one cheap query set for the ops overview., RecentCampaign, stats(), Admin, Session

### Community 40 - "Community 40"
Cohesion: 0.29
Nodes (6): ExperienceItem, PortfolioItemOut, Admin creator-database schemas (list + drill-down). Optional/List for 3.9 Pydant, RecentSubmissionItem, RichSocialItem, SocialItem

### Community 41 - "Community 41"
Cohesion: 0.40
Nodes (4): ProofVideoAttachIn, Submission schemas. Decimal money, Optional/List for 3.9 Pydantic., SubmissionCreateIn, SubmissionOut

### Community 42 - "Community 42"
Cohesion: 0.40
Nodes (3): city_exists(), Country/city validation so creators can't enter made-up places.  Country: must b, True if Nominatim finds <city> within <country>. Returns True on any     network

## Knowledge Gaps
- **44 isolated node(s):** `Engine`, `Session`, `Path`, `Admin`, `Session` (+39 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FastAPI` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 11`, `Community 12`, `Community 13`, `Community 15`, `Community 17`, `Community 18`, `Community 20`, `Community 21`, `Community 22`, `Community 24`, `Community 25`, `Community 26`, `Community 27`, `Community 29`, `Community 31`, `Community 34`, `Community 35`, `Community 37`, `Community 39`?**
  _High betweenness centrality (0.651) - this node is a cross-community bridge._
- **Why does `get_settings()` connect `Community 14` to `Community 32`, `Community 1`, `Community 0`, `Community 36`, `Community 5`, `Community 10`, `Community 12`, `Community 16`, `Community 24`, `Community 29`?**
  _High betweenness centrality (0.206) - this node is a cross-community bridge._
- **Why does `create_app()` connect `Community 1` to `Community 14`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Are the 33 inferred relationships involving `get_settings()` (e.g. with `_share_url()` and `settings()`) actually correct?**
  _`get_settings()` has 33 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `Base` (e.g. with `Campaign` and `CampaignBonusMilestone`) actually correct?**
  _`Base` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 18 inferred relationships involving `TimestampMixin` (e.g. with `Campaign` and `CampaignBonusMilestone`) actually correct?**
  _`TimestampMixin` has 18 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Application settings, loaded from environment / .env.`, `Fail fast on misconfiguration that is dangerous in production.          Called o`, `Auth dependencies — the security boundary. One per realm; aud claim keeps them s` to the rest of the system?**
  _214 weakly-connected nodes found - possible documentation gaps or missing edges._