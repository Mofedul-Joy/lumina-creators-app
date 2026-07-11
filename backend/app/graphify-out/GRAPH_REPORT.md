# Graph Report - backend/app  (2026-07-11)

## Corpus Check
- 83 files · ~36,490 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1035 nodes · 2314 edges · 52 communities
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 342 edges (avg confidence: 0.61)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `782c2381`
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
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]

## God Nodes (most connected - your core abstractions)
1. `FastAPI` - 47 edges
2. `get_settings()` - 39 edges
3. `Base` - 25 edges
4. `TimestampMixin` - 21 edges
5. `Session` - 21 edges
6. `UUID` - 19 edges
7. `LoginIn` - 18 edges
8. `RefreshIn` - 18 edges
9. `Admin` - 18 edges
10. `Session` - 18 edges

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
- 1-file cycle: `services/creators_export.py -> services/creators_export.py`
- 1-file cycle: `services/gamification.py -> services/gamification.py`
- 1-file cycle: `services/scrape_worker.py -> services/scrape_worker.py`

## Communities (52 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (36): Base, SQLAlchemy declarative base + shared column mixins., Base class for all ORM models., TimestampMixin, DeclarativeBase, Campaign, CampaignBonusMilestone, CampaignParticipation (+28 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (43): ClientListItem, list_clients(), Admin: list client (brand) accounts — powers the campaign builder's client picke, Admin realm router. All routes here will depend on get_current_admin., PlatformSettings, Admin settings: a read-only view of the deployed platform configuration.  These, settings(), AdminStats (+35 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (40): _already_paid_for_participation(), _approved_submission_count(), _avatar_url(), compute_owed_all(), compute_owed_for_creator(), compute_owed_for_participation(), _default_payment_method(), forecast_all() (+32 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (35): login(), me(), Admin auth: password login, refresh, me. Admins are provisioned, not self-signup, refresh(), login(), me(), Client (brand) auth: password login, refresh, me. Read-only realm; no signup., refresh() (+27 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (34): _aggregate_stats(), bump_streak_on_submission(), compute_awards(), compute_rank(), compute_xp(), get_creator_gamification(), next_rank_info(), CreatorProfile (+26 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (37): archive(), campaign_out(), campaign_overview(), close(), convert_to_advanced(), create(), disable_share(), enable_share() (+29 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (33): CampaignBonusMilestone, archive_campaign(), _check_mode_content(), close_campaign(), create_campaign(), creator_has_joined(), _drop_unset_defaults(), get_active_campaign() (+25 more)

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (29): _age(), applicant_detail(), _avatar_url(), _base_query(), counts(), export_csv(), list_applicants(), _now() (+21 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (45): add_experience(), add_portfolio(), add_social(), add_top_video(), _avatar_url(), completion(), confirm_social_verify(), delete_experience() (+37 more)

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (37): creator_activity(), creator_detail(), creator_rich_detail(), CreatorActivityOut, export_creators_csv(), flag_suspicious(), list_creators(), Admin creator database: filterable list + drill-down profile. Admin-only. (+29 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (34): ApifyNotConfigured, fast_thumbnail(), fetch_dataset(), _item_stats(), _item_thumbnail(), _item_url(), match_dataset(), _nn() (+26 more)

### Community 11 - "Community 11"
Cohesion: 0.20
Nodes (32): AddFundsIn, _date_range(), forecast(), history(), ledger(), manual(), owed(), owed_v2() (+24 more)

### Community 12 - "Community 12"
Cohesion: 0.10
Nodes (39): _is_disabled(), Auth dependencies — the security boundary. One per realm; aud claim keeps them s, A live token must not outlive a disabled account (admin) or a suspension., create_access_token(), create_impersonation_token(), create_refresh_token(), decode_token(), hash_token() (+31 more)

### Community 13 - "Community 13"
Cohesion: 0.16
Nodes (34): counts(), delete(), flag_suspicious(), list_submissions(), log_payout(), LogPayoutIn, _proof_url(), Admin submission review: list, verify, reject. Admin-only. (+26 more)

### Community 14 - "Community 14"
Cohesion: 0.19
Nodes (20): get_settings(), _client(), get_r2_object(), head_object(), is_local_mode(), is_proxy_mode(), local_path(), object_public_url() (+12 more)

### Community 15 - "Community 15"
Cohesion: 0.15
Nodes (21): browse(), detail(), join(), mine(), _public_out(), Creator-facing campaign browse + detail + join. Active campaigns only., Campaigns the creator applied to / joined, with their application status., browse() (+13 more)

### Community 16 - "Community 16"
Cohesion: 0.21
Nodes (21): ScrapedStats, ScrapeJob, _apply_stats(), _apply_zero_item_fallback(), _backoff(), compute_estimated_amount(), _due_jobs(), _is_paid() (+13 more)

### Community 17 - "Community 17"
Cohesion: 0.25
Nodes (20): brand_detail(), BrandCampaign, BrandDetail, create_user(), CreateUserIn, edit_client(), EditClientIn, list_users() (+12 more)

### Community 18 - "Community 18"
Cohesion: 0.19
Nodes (27): CreatorExperience, PortfolioItem, add_experience(), add_portfolio(), add_social(), add_top_video(), delete_experience(), delete_portfolio() (+19 more)

### Community 19 - "Community 19"
Cohesion: 0.16
Nodes (21): _bare_host(), canonicalize_url(), _demo(), detect_platform(), instagram_shortcode(), is_video_url(), match_key(), Submission URL canonicalization + hashing (the dedup rule from SCHEMA.md).  Beat (+13 more)

### Community 20 - "Community 20"
Cohesion: 0.23
Nodes (18): counts_by_status(), delete_submission(), _get(), _has_active_payout(), lifecycle_status(), list_submissions(), paid_submission_ids(), Session (+10 more)

### Community 21 - "Community 21"
Cohesion: 0.26
Nodes (17): SocialAccount, apply_eligibility(), _clean_handle(), confirm_verification(), _gen_code(), _mark_verified(), _norm(), _now() (+9 more)

### Community 22 - "Community 22"
Cohesion: 0.27
Nodes (15): _active_items_subq(), amounts_owed(), list_payouts(), log_manual_payment(), Decimal, Payout, Session, UUID (+7 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (13): AddFundsIn, ForecastRow, LedgerRow, ManualPaymentIn, OwedBreakdown, OwedRow, OwedRowV2, PayAllIn (+5 more)

### Community 24 - "Community 24"
Cohesion: 0.22
Nodes (8): Fail fast on misconfiguration that is dangerous in production.          Called o, get_db(), get_engine(), Session, Database engine + session dependency.  The engine is created lazily so the app c, FastAPI dependency yielding a DB session., Engine, RuntimeError

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
Cohesion: 0.11
Nodes (29): CampaignOverviewCreator, CampaignOverviewOut, BaseModel, CheckEmailOut, CreatorLoginOut, LoginIn, Auth request/response schemas. Email kept as str (no email-validator dep — ponyt, Password login may report that the account exists but has no password yet. (+21 more)

### Community 29 - "Community 29"
Cohesion: 0.26
Nodes (11): FileResponse, get_local(), get_r2(), _guard_local_mode(), _guard_proxy_mode(), put_local(), put_r2(), Public upload targets that stand in for direct-to-R2 presigned PUTs.  Two modes, (+3 more)

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (10): BonusMilestoneIn, CampaignCreateIn, CampaignOut, CampaignPublicOut, CampaignUpdateIn, MyCampaignOut, Campaign schemas. Money as Decimal (never float). Optional/List for 3.9 Pydantic, Step 3 of the campaign wizard — repeatable views-threshold bonus row. (+2 more)

### Community 31 - "Community 31"
Cohesion: 0.29
Nodes (10): AdminAnalytics, analytics(), DayPoint, Kpis, PlatformStat, Admin analytics — network-wide performance for the owner's overview.  All derive, TopCampaign, TopCreator (+2 more)

### Community 32 - "Community 32"
Cohesion: 0.29
Nodes (13): activity(), headline(), date, Session, UUID, Charts + headline numbers for the admin creator profile.  Weekly Post Overview —, Total posts / views / owed / avg CPM — the stat tiles above the Posts tab., Monday of the week `d` falls in. (+5 more)

### Community 33 - "Community 33"
Cohesion: 0.30
Nodes (11): accept(), create_invite(), _link(), list_invites(), peek(), Session, UUID, Creator invites: email an address and/or hand out a shareable join link.  Both c (+3 more)

### Community 34 - "Community 34"
Cohesion: 0.25
Nodes (14): _check_one(), embed_check_batch(), embed_check_one(), EmbedCheckResult, _needs_rehost(), Manual embed-health re-checks. Admin-only.  Separate from the scrape worker: thi, Missing, a platform CDN link (signed, short-lived, hotlink-blocked), or a     st, Re-resolve + self-host any submission thumbnail that isn't already ours.      Mu (+6 more)

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
Cohesion: 0.33
Nodes (9): create_invite(), InviteIn, InviteOut, list_invites(), Admin creator invites: email an address and/or share a join link. Admin-only., revoke_invite(), Admin, Session (+1 more)

### Community 40 - "Community 40"
Cohesion: 0.29
Nodes (6): ExperienceItem, PortfolioItemOut, Admin creator-database schemas (list + drill-down). Optional/List for 3.9 Pydant, RecentSubmissionItem, RichSocialItem, SocialItem

### Community 41 - "Community 41"
Cohesion: 0.40
Nodes (4): ProofVideoAttachIn, Submission schemas. Decimal money, Optional/List for 3.9 Pydantic., SubmissionCreateIn, SubmissionOut

### Community 42 - "Community 42"
Cohesion: 0.40
Nodes (3): city_exists(), Country/city validation so creators can't enter made-up places.  Country: must b, True if Nominatim finds <city> within <country>. Returns True on any     network

### Community 45 - "Community 45"
Cohesion: 0.38
Nodes (9): create_admin_image_upload(), create_presigned_upload(), finalize_admin_image(), finalize_upload(), Session, StorageObject, UUID, Upload lifecycle: presign -> (client PUTs to R2) -> finalize. Only finalized obj (+1 more)

### Community 46 - "Community 46"
Cohesion: 0.36
Nodes (7): _avatar_urls(), get_report(), Public, unauthenticated client report (Feature 6, BUILD_SPEC.md §3.7).  GET /pub, Session, PublicReportOut, PublicReportSubmissionRow, Public, unauthenticated client report (Feature 6, BUILD_SPEC.md §3.7).  STRICTLY

### Community 47 - "Community 47"
Cohesion: 0.33
Nodes (8): export_rows(), _money(), _profile_details(), CreatorProfile, Decimal, Session, Creator-database CSV export (admin).  Column set mirrors the reference platform', (header, rows) for every creator. Aggregates are pre-computed in grouped     que

### Community 48 - "Community 48"
Cohesion: 0.48
Nodes (6): Transactional email. Prefers Resend (HTTP — works from cloud hosts that block ou, True if the mail was handed to a transport. False when nothing is     configured, _send(), send_creator_invite(), _send_resend(), send_verification_code()

### Community 49 - "Community 49"
Cohesion: 0.43
Nodes (6): _avatar_url(), overview(), CreatorProfile, Session, UUID, Admin campaign overview: the stat tiles + active-creator list on the detail page

### Community 50 - "Community 50"
Cohesion: 0.40
Nodes (5): is_self_hosted(), Re-host remote post thumbnails on our own storage.  Storing the platform's CDN U, True only if `url` is served by THIS deployment's storage.      Deliberately not, Download `url` and store it on our own storage; return our public URL.      Retu, rehost()

### Community 51 - "Community 51"
Cohesion: 0.40
Nodes (4): health(), health_db(), Public health checks — the ONLY public routes (closed marketplace)., Verifies DB connectivity. Returns 200 with status 'unconfigured' if no DB set ye

## Knowledge Gaps
- **52 isolated node(s):** `Engine`, `Session`, `Path`, `Admin`, `Session` (+47 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FastAPI` connect `Community 1` to `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 11`, `Community 12`, `Community 13`, `Community 15`, `Community 17`, `Community 18`, `Community 20`, `Community 21`, `Community 22`, `Community 25`, `Community 26`, `Community 27`, `Community 29`, `Community 31`, `Community 33`, `Community 34`, `Community 35`, `Community 37`, `Community 39`, `Community 45`, `Community 46`, `Community 51`?**
  _High betweenness centrality (0.622) - this node is a cross-community bridge._
- **Why does `get_settings()` connect `Community 14` to `Community 1`, `Community 33`, `Community 36`, `Community 5`, `Community 10`, `Community 12`, `Community 45`, `Community 48`, `Community 16`, `Community 50`, `Community 51`, `Community 21`, `Community 24`, `Community 29`?**
  _High betweenness centrality (0.238) - this node is a cross-community bridge._
- **Why does `create_app()` connect `Community 1` to `Community 14`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **Are the 37 inferred relationships involving `get_settings()` (e.g. with `_share_url()` and `settings()`) actually correct?**
  _`get_settings()` has 37 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `Base` (e.g. with `Campaign` and `CampaignBonusMilestone`) actually correct?**
  _`Base` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `TimestampMixin` (e.g. with `Campaign` and `CampaignBonusMilestone`) actually correct?**
  _`TimestampMixin` has 20 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Application settings, loaded from environment / .env.`, `Fail fast on misconfiguration that is dangerous in production.          Called o`, `Auth dependencies — the security boundary. One per realm; aud claim keeps them s` to the rest of the system?**
  _261 weakly-connected nodes found - possible documentation gaps or missing edges._