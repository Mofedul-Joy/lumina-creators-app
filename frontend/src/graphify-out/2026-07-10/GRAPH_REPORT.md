# Graph Report - lumina-creators-app/frontend/src  (2026-07-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 585 nodes · 1461 edges · 26 communities (24 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 25|Community 25]]

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 97 edges
2. `auth()` - 51 edges
3. `fmtInt()` - 30 edges
4. `fmtMoney()` - 29 edges
5. `getAdminToken()` - 21 edges
6. `isAuthError()` - 20 edges
7. `AdminShell()` - 17 edges
8. `AdminTabs()` - 17 edges
9. `platformLabel()` - 16 edges
10. `getAuthToken()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `AdminDashboardPage()` --calls--> `fmtInt()`  [INFERRED]
  app/(admin)/admin/dashboard/page.tsx → lib/format.ts
- `AdminPaymentsPage()` --calls--> `fmtMoney()`  [EXTRACTED]
  app/(admin)/admin/payments/page.tsx → lib/format.ts
- `AdminUsersPage()` --calls--> `fmtInt()`  [EXTRACTED]
  app/(admin)/admin/users/page.tsx → lib/format.ts
- `DashboardInner()` --calls--> `fmtInt()`  [INFERRED]
  app/(client)/client/dashboard/page.tsx → lib/format.ts
- `AdminDashboardPage()` --calls--> `isAuthError()`  [INFERRED]
  app/(admin)/admin/dashboard/page.tsx → lib/api.ts

## Import Cycles
- None detected.

## Communities (26 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (37): COUNTRY_FLAGS, CreatorDetailCard(), flagFor(), fmtMoney(), fmtNumber(), PLATFORM_GRADIENT, DAYS, MILESTONES (+29 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (36): AccountPage(), SubmissionDetailModal(), AdminAnalyticsPage(), PLATFORM_LABEL, ALL_PLATFORMS, CardInner(), MODE_LABEL, CampaignModal() (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (35): CampaignCard(), CardInner(), ALL_PLATFORMS, CampaignsPage(), Sort, SORTS, CampaignSearchModal(), SUGGESTED (+27 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (24): AuthCard(), POINTS, adminLogin(), clientLogin(), creatorCheckEmail(), CreatorCheckEmailResult, creatorLogin(), CreatorLoginResult (+16 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (19): AdminShell(), AdminTabs(), StatusBadge(), STYLES, AdminDashboardPage(), DashboardInner(), createUser(), downloadPayoutReportsCsv() (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (26): confirmSocialVerify(), CREATOR_TYPES, CreatorType, deletePortfolio(), deleteSocial(), EDUCATION_LEVELS, listPortfolio(), PAYOUT_METHODS (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (32): SharePageLink(), addWalletFunds(), auth(), CreatorRow, disableShareToken(), enableShareToken(), flagSubmissionSuspicious(), ForecastRow (+24 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (11): AdminSidebar(), NAV, CreatorLayout(), CreatorSidebar(), NAV, NavItem, CreatorTopbar(), NotificationDrawer() (+3 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (27): addSocial(), API_URL, CompletionOut, CreatorDetail, CreatorListItem, EducationLevel, ExperienceItem, Health (+19 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (27): AdminAnalytics, AdminCampaign, AdminClient, AdminStats, ApplicantFilters, ApplicantSocial, ApplicantUpdateIn, ApplicantVideo (+19 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (11): ALL_PLATFORMS, clearClientToken(), getClientToken(), auth(), ClientCampaign, ClientSubmission, listClientCampaigns(), listClientSubmissions() (+3 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (16): BonusMilestone, CampaignCreate, createCampaign(), PaymentType, publishCampaign(), AGE_REQUIREMENTS, CREATOR_TYPES, initialState (+8 more)

### Community 12 - "Community 12"
Cohesion: 0.15
Nodes (12): Pager(), windowed(), PLATFORMS, STATUSES, SubmissionsSection(), AdminSubmission, getSubmissionCounts(), listAdminCampaigns() (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (12): Avatar(), AdminApplicantsPage(), TabKey, TABS, useDebounced(), ApplicantCounts, ApplicantDetail, ApplicantListItem (+4 more)

### Community 14 - "Community 14"
Cohesion: 0.15
Nodes (11): METHOD_LABEL, METHODS, deleteSubmission(), logSubmissionPayout(), PayoutMethod, rejectSubmission(), flagCreatorSuspicious(), getCreatorDetail() (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (10): AdminCreatorsPage(), EMPTY, Prefs, RANK_STYLE, useDebounced(), CreatorFilters, Gender, GENDERS (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (9): BannerInput(), ALL_PLATFORMS, FormState, PLATFORM_LABEL, adminUploadImage(), CampaignUpdate, getAdminCampaign(), impersonateClient() (+1 more)

### Community 17 - "Community 17"
Cohesion: 0.15
Nodes (3): archiveCampaign(), closeCampaign(), reopenCampaign()

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (6): ORDER, ProfileGateModal(), SECTION_LABEL, SECTION_STEP, getCompletion(), ProfileSection

### Community 20 - "Community 20"
Cohesion: 0.38
Nodes (7): addPortfolio(), finalizeUpload(), presignUpload(), putToPresignedUrl(), uploadFile(), uploadPortfolioVideo(), uploadProofVideo()

### Community 21 - "Community 21"
Cohesion: 0.40
Nodes (3): metadata, serif, Providers()

### Community 22 - "Community 22"
Cohesion: 0.50
Nodes (3): Platform, isValidVideoUrl(), platformFromUrl()

## Knowledge Gaps
- **146 isolated node(s):** `PLATFORM_LABEL`, `TabKey`, `TABS`, `ALL_PLATFORMS`, `PLATFORM_LABEL` (+141 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiFetch()` connect `Community 6` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 19`, `Community 20`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `fmtMoney()` connect `Community 1` to `Community 0`, `Community 2`, `Community 4`, `Community 6`, `Community 12`, `Community 14`, `Community 16`, `Community 17`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `fmtInt()` connect `Community 1` to `Community 0`, `Community 2`, `Community 4`, `Community 6`, `Community 10`, `Community 12`, `Community 14`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `fmtInt()` (e.g. with `AdminDashboardPage()` and `DashboardInner()`) actually correct?**
  _`fmtInt()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PLATFORM_LABEL`, `TabKey`, `TABS` to the rest of the system?**
  _146 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0576271186440678 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08248587570621468 - nodes in this community are weakly interconnected._