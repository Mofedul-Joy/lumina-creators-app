# Graph Report - frontend/src  (2026-07-11)

## Corpus Check
- 106 files · ~76,594 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 686 nodes · 1736 edges · 26 communities (23 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 25|Community 25]]

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 114 edges
2. `auth()` - 59 edges
3. `fmtInt()` - 41 edges
4. `fmtMoney()` - 35 edges
5. `getAdminToken()` - 23 edges
6. `isAuthError()` - 21 edges
7. `AdminShell()` - 18 edges
8. `AdminTabs()` - 18 edges
9. `platformLabel()` - 17 edges
10. `getAuthToken()` - 17 edges

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

## Communities (26 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (35): TabKey, TABS, COUNTRY_FLAGS, CreatorDetailCard(), flagFor(), fmtMoney(), fmtNumber(), PLATFORM_GRADIENT (+27 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (49): AccountPage(), METHOD_LABEL, METHODS, SubmissionDetailModal(), PLATFORMS, STATUSES, AdminAnalyticsPage(), ALL_PLATFORMS (+41 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (37): ALL_PLATFORMS, CampaignsPage(), Sort, SORTS, CampaignSearchModal(), SUGGESTED, ApiError, finalizeUpload() (+29 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (38): AdminSidebar(), NAV, AuthCard(), POINTS, ALL_PLATFORMS, DashboardInner(), peekInvite(), adminLogin() (+30 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (25): AdminShell(), AdminTabs(), BannerInput(), Pager(), windowed(), SharePageLink(), StatusBadge(), STYLES (+17 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (26): addSocial(), confirmSocialVerify(), CREATOR_TYPES, CreatorType, deletePortfolio(), deleteSocial(), EducationLevel, listPortfolio() (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (25): addWalletFunds(), CreatorRow, downloadPayoutReportsCsv(), ForecastRow, getForecast(), getLedger(), getSpendingSummary(), getWallet() (+17 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (7): CreatorLayout(), CreatorSidebar(), NAV, NavItem, CreatorTopbar(), NotificationDrawer(), clearAuthToken()

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (30): addPortfolio(), API_URL, CompletionOut, CreatorDetail, CreatorListItem, EDUCATION_LEVELS, ExperienceIn, ExperienceItem (+22 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (30): AdminAnalytics, AdminCampaign, AdminClient, AdminStats, ApplicantFilters, ApplicantSocial, ApplicantUpdateIn, ApplicantVideo (+22 more)

### Community 10 - "Community 10"
Cohesion: 0.20
Nodes (10): PLATFORMS, TopVideosTab(), VideoCard(), addTopVideo(), deleteTopVideo(), listTopVideos(), refreshTopVideo(), TopVideoOut (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (34): NewCampaignModal(), Stage, CampaignDetailPage(), BonusMilestone, CampaignCreate, PaymentType, CAMPAIGN_KINDS, CampaignKind (+26 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (45): adminUploadImage(), archiveCampaign(), auth(), closeCampaign(), convertCampaignToAdvanced(), createCampaign(), createInvite(), createUser() (+37 more)

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (6): CreatorRichDetail, getMyPortfolio(), hostOf(), logoFor(), normUrl(), PLATFORM_GRADIENT

### Community 14 - "Community 14"
Cohesion: 0.13
Nodes (13): MODES, RemoveCreatorModal(), SCOPES, ChartTooltip(), ViewsGrowthChart(), ViewsPoint, WeeklyPostChart(), WeeklyPostPoint (+5 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (25): Avatar(), COLUMNS, ExportCreatorsModal(), InviteCreatorModal(), AdminApplicantsPage(), TabKey, TABS, useDebounced() (+17 more)

### Community 16 - "Community 16"
Cohesion: 0.25
Nodes (7): AddExperienceModal(), KINDS, Step, addExperience(), ExperienceKind, ExperienceOut, listRoleTitles()

### Community 17 - "Community 17"
Cohesion: 0.50
Nodes (3): disableShareToken(), enableShareToken(), rotateShareToken()

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (6): ORDER, ProfileGateModal(), SECTION_LABEL, SECTION_STEP, getCompletion(), ProfileSection

### Community 21 - "Community 21"
Cohesion: 0.40
Nodes (3): metadata, serif, Providers()

### Community 22 - "Community 22"
Cohesion: 0.50
Nodes (3): Platform, isValidVideoUrl(), platformFromUrl()

## Knowledge Gaps
- **165 isolated node(s):** `PLATFORM_LABEL`, `TabKey`, `TABS`, `ALL_PLATFORMS`, `PLATFORM_LABEL` (+160 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiFetch()` connect `Community 12` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 9`, `Community 10`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 19`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `fmtInt()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 10`, `Community 11`, `Community 13`, `Community 14`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `fmtMoney()` connect `Community 1` to `Community 0`, `Community 2`, `Community 4`, `Community 6`, `Community 11`, `Community 13`, `Community 14`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `fmtInt()` (e.g. with `AdminDashboardPage()` and `DashboardInner()`) actually correct?**
  _`fmtInt()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PLATFORM_LABEL`, `TabKey`, `TABS` to the rest of the system?**
  _165 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06077694235588972 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0636030636030636 - nodes in this community are weakly interconnected._