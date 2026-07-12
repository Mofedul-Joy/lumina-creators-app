# Graph Report - frontend/src  (2026-07-12)

## Corpus Check
- 111 files · ~80,587 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 726 nodes · 1844 edges · 34 communities (32 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `51066df1`
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
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 127 edges
2. `auth()` - 66 edges
3. `fmtInt()` - 41 edges
4. `fmtMoney()` - 35 edges
5. `isAuthError()` - 24 edges
6. `getAdminToken()` - 24 edges
7. `getAuthToken()` - 23 edges
8. `AdminShell()` - 19 edges
9. `AdminTabs()` - 18 edges
10. `platformLabel()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `AdminCampaignDetailPage()` --calls--> `fmtMoney()`  [EXTRACTED]
  app/(admin)/admin/campaigns/[id]/edit/page.tsx → lib/format.ts
- `CreatorRow()` --calls--> `fmtInt()`  [INFERRED]
  app/(admin)/admin/campaigns/[id]/page.tsx → lib/format.ts
- `CampaignDetailPage()` --calls--> `campaignImage()`  [INFERRED]
  app/(admin)/admin/campaigns/[id]/page.tsx → lib/campaignTheme.ts
- `CampaignDetailPage()` --calls--> `fmtInt()`  [INFERRED]
  app/(admin)/admin/campaigns/[id]/page.tsx → lib/format.ts
- `AdminCreatorDetailPage()` --calls--> `fmtInt()`  [INFERRED]
  app/(admin)/admin/creators/[id]/page.tsx → lib/format.ts

## Import Cycles
- None detected.

## Communities (34 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (14): ContractDocument(), ALL_PLATFORMS, DashboardInner(), acceptContract(), getContract(), clearClientToken(), getClientToken(), auth() (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.15
Nodes (22): AccountPage(), CampaignModal(), AdminCreatorDetailPage(), CreatorRow(), publicApi, AGE_REQUIREMENT_LABEL, PAYMENT_TYPE_LABEL, PaymentFields (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (20): ApiError, finalizeUpload(), listMyCampaigns(), presignUpload(), putToPresignedUrl(), uploadFile(), auth(), BonusMilestone (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (32): AdminSidebar(), NAV, AuthCard(), POINTS, NAV, NavItem, peekInvite(), adminLogin() (+24 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (34): AdminShell(), AdminTabs(), BannerInput(), Pager(), windowed(), SharePageLink(), StatusBadge(), STYLES (+26 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (34): addPortfolio(), addSocial(), confirmSocialVerify(), CREATOR_TYPES, CreatorType, deletePortfolio(), deleteSocial(), EDUCATION_LEVELS (+26 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (23): addWalletFunds(), downloadPayoutReportsCsv(), ForecastRow, getForecast(), getLedger(), getSpendingSummary(), getWallet(), LedgerRow (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.28
Nodes (5): CreatorLayout(), CreatorSidebar(), CreatorTopbar(), RankBadge(), getUnreadCount()

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (37): AddExperienceModal(), KINDS, Step, addExperience(), API_URL, CompletionOut, ContractDetail, ContractSummary (+29 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (32): AdminAnalytics, AdminCampaign, AdminClient, AdminStats, ApplicantFilters, ApplicantSocial, ApplicantUpdateIn, ApplicantVideo (+24 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (14): NotificationDrawer(), PLATFORMS, TopVideosTab(), VideoCard(), addTopVideo(), deleteTopVideo(), listNotifications(), listTopVideos() (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (34): NewCampaignModal(), Stage, CampaignDetailPage(), BonusMilestone, CampaignCreate, PaymentType, CAMPAIGN_KINDS, CampaignKind (+26 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (49): adminUploadImage(), archiveCampaign(), auth(), closeCampaign(), convertCampaignToAdvanced(), createCampaign(), createInvite(), createUser() (+41 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (13): ALL_PLATFORMS, CardInner(), MODE_LABEL, CampaignCard(), CardInner(), PublicCampaign, campaignImage(), campaignTag() (+5 more)

### Community 14 - "Community 14"
Cohesion: 0.14
Nodes (16): METHOD_LABEL, METHODS, SubmissionDetailModal(), PLATFORMS, STATUSES, AdminSubmission, PayoutMethod, flagCreatorSuspicious() (+8 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (23): Avatar(), COLUMNS, ExportCreatorsModal(), InviteCreatorModal(), AdminApplicantsPage(), TabKey, TABS, useDebounced() (+15 more)

### Community 16 - "Community 16"
Cohesion: 0.25
Nodes (6): MODES, RemoveCreatorModal(), SCOPES, RemovalMode, RemovalScope, removeCreator()

### Community 17 - "Community 17"
Cohesion: 0.17
Nodes (7): TabKey, TABS, AWARD_META, AwardRow(), StreakFlame(), deleteExperience(), listExperiences()

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (6): ORDER, ProfileGateModal(), SECTION_LABEL, SECTION_STEP, getCompletion(), ProfileSection

### Community 20 - "Community 20"
Cohesion: 0.18
Nodes (13): ALL_PLATFORMS, CampaignsPage(), Sort, SORTS, CampaignSearchModal(), SUGGESTED, listSocials(), Campaign (+5 more)

### Community 21 - "Community 21"
Cohesion: 0.40
Nodes (3): metadata, serif, Providers()

### Community 22 - "Community 22"
Cohesion: 0.19
Nodes (11): COUNTRY_FLAGS, CreatorDetailCard(), flagFor(), fmtMoney(), fmtNumber(), PLATFORM_GRADIENT, nextRankInfo(), getCreatorRichDetail() (+3 more)

### Community 26 - "Community 26"
Cohesion: 0.22
Nodes (6): CreatorRichDetail, getMyPortfolio(), hostOf(), logoFor(), normUrl(), PLATFORM_GRADIENT

### Community 27 - "Community 27"
Cohesion: 0.22
Nodes (7): AddCreatorsToCampaignModal(), Tab, CampaignInviteSummary, CreatorRow, getCampaignInviteLink(), inviteToCampaign(), listCreators()

### Community 28 - "Community 28"
Cohesion: 0.29
Nodes (5): GemstoneRank, RANK_ORDER, RANK_STYLES, RANK_THRESHOLDS, XpBar()

### Community 29 - "Community 29"
Cohesion: 0.29
Nodes (4): getPublicReport(), PublicReport, PublicReportSubmission, PublicReportPage()

### Community 30 - "Community 30"
Cohesion: 0.33
Nodes (4): STATUS_LABEL, STATUS_STYLE, ContractStatus, listMyContracts()

### Community 31 - "Community 31"
Cohesion: 0.33
Nodes (5): AwardKey, CreatorGamification, GemstoneRank, getMyGamification(), KNOWN_AWARDS

### Community 32 - "Community 32"
Cohesion: 0.40
Nodes (3): DAYS, MILESTONES, getProfile()

### Community 33 - "Community 33"
Cohesion: 0.50
Nodes (3): disableShareToken(), enableShareToken(), rotateShareToken()

## Knowledge Gaps
- **172 isolated node(s):** `PLATFORM_LABEL`, `TabKey`, `TABS`, `ALL_PLATFORMS`, `PLATFORM_LABEL` (+167 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiFetch()` connect `Community 12` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 19`, `Community 20`, `Community 22`, `Community 26`, `Community 27`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 33`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `fmtInt()` connect `Community 1` to `Community 0`, `Community 2`, `Community 4`, `Community 6`, `Community 10`, `Community 11`, `Community 14`, `Community 17`, `Community 26`, `Community 29`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `fmtMoney()` connect `Community 1` to `Community 32`, `Community 2`, `Community 4`, `Community 6`, `Community 11`, `Community 13`, `Community 14`, `Community 17`, `Community 26`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `fmtInt()` (e.g. with `AdminDashboardPage()` and `DashboardInner()`) actually correct?**
  _`fmtInt()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `isAuthError()` (e.g. with `AdminDashboardPage()` and `DashboardInner()`) actually correct?**
  _`isAuthError()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PLATFORM_LABEL`, `TabKey`, `TABS` to the rest of the system?**
  _172 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11333333333333333 - nodes in this community are weakly interconnected._