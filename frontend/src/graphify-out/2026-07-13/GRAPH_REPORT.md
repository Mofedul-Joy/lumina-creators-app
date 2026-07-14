# Graph Report - frontend/src  (2026-07-12)

## Corpus Check
- 112 files · ~80,786 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 728 nodes · 1849 edges · 27 communities (25 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b58962dd`
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
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
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

## Communities (27 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (15): ContractDocument(), ALL_PLATFORMS, DashboardInner(), acceptContract(), getContract(), clearClientToken(), getClientToken(), setClientToken() (+7 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (56): AccountPage(), METHOD_LABEL, METHODS, SubmissionDetailModal(), PLATFORMS, STATUSES, AdminAnalyticsPage(), PLATFORM_LABEL (+48 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (37): ALL_PLATFORMS, CampaignsPage(), Sort, SORTS, CampaignSearchModal(), SUGGESTED, ApiError, finalizeUpload() (+29 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (31): AdminSidebar(), NAV, AuthCard(), POINTS, NAV, NavItem, peekInvite(), adminLogin() (+23 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (32): AdminShell(), AdminTabs(), BannerInput(), NewCampaignModal(), Pager(), windowed(), SharePageLink(), StatusBadge() (+24 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (32): addPortfolio(), addSocial(), confirmSocialVerify(), CREATOR_TYPES, CreatorType, deletePortfolio(), deleteSocial(), EDUCATION_LEVELS (+24 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (23): addWalletFunds(), downloadPayoutReportsCsv(), ForecastRow, getForecast(), getLedger(), getSpendingSummary(), getWallet(), LedgerRow (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (7): AddExperienceModal(), KINDS, Step, addExperience(), ExperienceKind, ExperienceOut, listRoleTitles()

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (39): PLATFORMS, TopVideosTab(), VideoCard(), addTopVideo(), API_URL, CompletionOut, ContractDetail, ContractSummary (+31 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (32): AdminAnalytics, AdminCampaign, AdminClient, AdminStats, ApplicantFilters, ApplicantSocial, ApplicantUpdateIn, ApplicantVideo (+24 more)

### Community 10 - "Community 10"
Cohesion: 0.21
Nodes (8): CreatorLayout(), CreatorSidebar(), CreatorTopbar(), NotificationDrawer(), listNotifications(), markNotificationsRead(), NotificationOut, getAuthToken()

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (33): Stage, CampaignDetailPage(), BonusMilestone, CampaignCreate, PaymentType, CAMPAIGN_KINDS, CampaignKind, CYCLE_TRIGGERS (+25 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (49): adminUploadImage(), archiveCampaign(), auth(), closeCampaign(), convertCampaignToAdvanced(), createCampaign(), createInvite(), createUser() (+41 more)

### Community 15 - "Community 15"
Cohesion: 0.10
Nodes (14): COLUMNS, ExportCreatorsModal(), InviteCreatorModal(), AdminCreatorsPage(), EMPTY, Prefs, RANK_STYLE, useDebounced() (+6 more)

### Community 16 - "Community 16"
Cohesion: 0.25
Nodes (6): MODES, RemoveCreatorModal(), SCOPES, RemovalMode, RemovalScope, removeCreator()

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (14): TabKey, TABS, AWARD_META, AwardRow(), GemstoneRank, RANK_ORDER, RANK_STYLES, RANK_THRESHOLDS (+6 more)

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (6): ORDER, ProfileGateModal(), SECTION_LABEL, SECTION_STEP, getCompletion(), ProfileSection

### Community 21 - "Community 21"
Cohesion: 0.40
Nodes (3): metadata, serif, Providers()

### Community 22 - "Community 22"
Cohesion: 0.07
Nodes (27): Avatar(), COUNTRY_FLAGS, CreatorDetailCard(), flagFor(), fmtMoney(), fmtNumber(), PLATFORM_GRADIENT, AdminApplicantsPage() (+19 more)

### Community 27 - "Community 27"
Cohesion: 0.22
Nodes (7): AddCreatorsToCampaignModal(), Tab, CampaignInviteSummary, CreatorRow, getCampaignInviteLink(), inviteToCampaign(), listCreators()

### Community 30 - "Community 30"
Cohesion: 0.33
Nodes (4): STATUS_LABEL, STATUS_STYLE, ContractStatus, listMyContracts()

### Community 31 - "Community 31"
Cohesion: 0.20
Nodes (8): DAYS, MILESTONES, getProfile(), AwardKey, CreatorGamification, GemstoneRank, getMyGamification(), KNOWN_AWARDS

### Community 33 - "Community 33"
Cohesion: 0.50
Nodes (3): disableShareToken(), enableShareToken(), rotateShareToken()

## Knowledge Gaps
- **172 isolated node(s):** `PLATFORM_LABEL`, `TabKey`, `TABS`, `ALL_PLATFORMS`, `PLATFORM_LABEL` (+167 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiFetch()` connect `Community 12` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 15`, `Community 16`, `Community 17`, `Community 19`, `Community 22`, `Community 27`, `Community 30`, `Community 31`, `Community 33`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `fmtInt()` connect `Community 1` to `Community 0`, `Community 2`, `Community 4`, `Community 6`, `Community 8`, `Community 11`, `Community 17`, `Community 22`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `fmtMoney()` connect `Community 1` to `Community 2`, `Community 4`, `Community 6`, `Community 11`, `Community 17`, `Community 22`, `Community 31`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `fmtInt()` (e.g. with `AdminDashboardPage()` and `DashboardInner()`) actually correct?**
  _`fmtInt()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `isAuthError()` (e.g. with `AdminDashboardPage()` and `DashboardInner()`) actually correct?**
  _`isAuthError()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PLATFORM_LABEL`, `TabKey`, `TABS` to the rest of the system?**
  _172 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1076923076923077 - nodes in this community are weakly interconnected._