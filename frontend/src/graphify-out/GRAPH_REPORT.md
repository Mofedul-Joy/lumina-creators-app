# Graph Report - frontend/src  (2026-07-11)

## Corpus Check
- 107 files · ~78,219 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 701 nodes · 1782 edges · 33 communities (30 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bae95939`
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

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 121 edges
2. `auth()` - 63 edges
3. `fmtInt()` - 41 edges
4. `fmtMoney()` - 35 edges
5. `getAdminToken()` - 23 edges
6. `isAuthError()` - 21 edges
7. `getAuthToken()` - 21 edges
8. `AdminShell()` - 18 edges
9. `AdminTabs()` - 18 edges
10. `platformLabel()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `CreatorRow()` --calls--> `fmtInt()`  [INFERRED]
  app/(admin)/admin/campaigns/[id]/page.tsx → lib/format.ts
- `AdminCreatorDetailPage()` --calls--> `fmtInt()`  [INFERRED]
  app/(admin)/admin/creators/[id]/page.tsx → lib/format.ts
- `AdminCampaignDetailPage()` --calls--> `fmtMoney()`  [EXTRACTED]
  app/(admin)/admin/campaigns/[id]/edit/page.tsx → lib/format.ts
- `CampaignDetailPage()` --calls--> `campaignImage()`  [INFERRED]
  app/(admin)/admin/campaigns/[id]/page.tsx → lib/campaignTheme.ts
- `CampaignDetailPage()` --calls--> `fmtInt()`  [INFERRED]
  app/(admin)/admin/campaigns/[id]/page.tsx → lib/format.ts

## Import Cycles
- None detected.

## Communities (33 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (9): TabKey, TABS, DAYS, MILESTONES, deleteExperience(), getProfile(), listExperiences(), Skeleton() (+1 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (51): AccountPage(), METHOD_LABEL, METHODS, SubmissionDetailModal(), PLATFORMS, STATUSES, ALL_PLATFORMS, CardInner() (+43 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (36): CampaignCard(), ALL_PLATFORMS, CampaignsPage(), Sort, SORTS, CampaignSearchModal(), SUGGESTED, ApiError (+28 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (38): AdminSidebar(), NAV, AuthCard(), POINTS, ALL_PLATFORMS, DashboardInner(), peekInvite(), adminLogin() (+30 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (21): AdminShell(), AdminTabs(), Pager(), windowed(), SharePageLink(), StatusBadge(), STYLES, SubmissionsSection() (+13 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (30): addSocial(), confirmSocialVerify(), CREATOR_TYPES, CreatorType, deletePortfolio(), deleteSocial(), EDUCATION_LEVELS, EducationLevel (+22 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (20): addWalletFunds(), ForecastRow, getForecast(), getLedger(), getWallet(), LedgerRow, listOwedV2(), OwedRowV2 (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (10): CreatorLayout(), CreatorSidebar(), NAV, NavItem, CreatorTopbar(), NotificationDrawer(), listNotifications(), markNotificationsRead() (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (29): addPortfolio(), API_URL, CompletionOut, CreatorDetail, CreatorListItem, ExperienceIn, ExperienceItem, Health (+21 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (34): InviteCreatorModal(), AdminAnalytics, AdminCampaign, AdminClient, AdminStats, ApplicantFilters, ApplicantSocial, ApplicantUpdateIn (+26 more)

### Community 10 - "Community 10"
Cohesion: 0.20
Nodes (9): PLATFORMS, TopVideosTab(), VideoCard(), addTopVideo(), deleteTopVideo(), listTopVideos(), refreshTopVideo(), TopVideoOut (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (34): NewCampaignModal(), Stage, CampaignDetailPage(), BonusMilestone, CampaignCreate, PaymentType, CAMPAIGN_KINDS, CampaignKind (+26 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (36): auth(), closeCampaign(), createCampaign(), deleteSubmission(), disableShareToken(), enableShareToken(), flagSubmissionSuspicious(), getAdminAnalytics() (+28 more)

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (6): CreatorRichDetail, getMyPortfolio(), hostOf(), logoFor(), normUrl(), PLATFORM_GRADIENT

### Community 14 - "Community 14"
Cohesion: 0.13
Nodes (13): MODES, RemoveCreatorModal(), SCOPES, ChartTooltip(), ViewsGrowthChart(), ViewsPoint, WeeklyPostChart(), WeeklyPostPoint (+5 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (10): AdminCreatorsPage(), EMPTY, Prefs, RANK_STYLE, useDebounced(), CreatorFilters, Gender, GENDERS (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.25
Nodes (7): AddExperienceModal(), KINDS, Step, addExperience(), ExperienceKind, ExperienceOut, listRoleTitles()

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (12): COUNTRY_FLAGS, CreatorDetailCard(), flagFor(), fmtMoney(), fmtNumber(), PLATFORM_GRADIENT, nextRankInfo(), getCreatorRichDetail() (+4 more)

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (6): ORDER, ProfileGateModal(), SECTION_LABEL, SECTION_STEP, getCompletion(), ProfileSection

### Community 21 - "Community 21"
Cohesion: 0.40
Nodes (3): metadata, serif, Providers()

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (11): BannerInput(), CreatorRow(), adminUploadImage(), archiveCampaign(), CampaignOverviewCreator, convertCampaignToAdvanced(), getAdminCampaign(), getCampaignOverview() (+3 more)

### Community 26 - "Community 26"
Cohesion: 0.19
Nodes (9): Avatar(), AdminApplicantsPage(), TabKey, TABS, useDebounced(), ApplicantCounts, ApplicantDetail, ApplicantListItem (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.22
Nodes (7): AddCreatorsToCampaignModal(), Tab, CampaignInviteSummary, CreatorRow, getCampaignInviteLink(), inviteToCampaign(), listCreators()

### Community 28 - "Community 28"
Cohesion: 0.25
Nodes (7): RankBadge(), getUnreadCount(), AwardKey, CreatorGamification, GemstoneRank, getMyGamification(), KNOWN_AWARDS

### Community 29 - "Community 29"
Cohesion: 0.22
Nodes (6): createUser(), editClient(), getUsers(), listAdminCampaigns(), reactivateClient(), suspendClient()

### Community 30 - "Community 30"
Cohesion: 0.25
Nodes (7): COLUMNS, ExportCreatorsModal(), downloadCreatorsCsv(), downloadPayoutReportsCsv(), getSpendingSummary(), rangeQs(), downloadCsv()

### Community 31 - "Community 31"
Cohesion: 0.32
Nodes (3): AWARD_META, AwardRow(), StreakFlame()

### Community 32 - "Community 32"
Cohesion: 0.29
Nodes (5): GemstoneRank, RANK_ORDER, RANK_STYLES, RANK_THRESHOLDS, XpBar()

## Knowledge Gaps
- **167 isolated node(s):** `PLATFORM_LABEL`, `TabKey`, `TABS`, `ALL_PLATFORMS`, `PLATFORM_LABEL` (+162 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiFetch()` connect `Community 12` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 19`, `Community 22`, `Community 27`, `Community 28`, `Community 29`, `Community 30`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `fmtInt()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 10`, `Community 11`, `Community 13`, `Community 14`, `Community 22`, `Community 29`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `fmtMoney()` connect `Community 1` to `Community 0`, `Community 2`, `Community 4`, `Community 6`, `Community 11`, `Community 13`, `Community 14`, `Community 22`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `fmtInt()` (e.g. with `AdminDashboardPage()` and `DashboardInner()`) actually correct?**
  _`fmtInt()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PLATFORM_LABEL`, `TabKey`, `TABS` to the rest of the system?**
  _167 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14705882352941177 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._