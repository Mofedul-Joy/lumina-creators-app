# Graph Report - lumina-creators-app/frontend/src  (2026-07-13)

## Corpus Check
- 125 files · ~93,609 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 814 nodes · 2111 edges · 33 communities (30 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 33|Community 33]]

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 147 edges
2. `auth()` - 70 edges
3. `fmtInt()` - 43 edges
4. `fmtMoney()` - 37 edges
5. `getAdminToken()` - 36 edges
6. `getAuthToken()` - 26 edges
7. `isAuthError()` - 25 edges
8. `AdminShell()` - 20 edges
9. `platformLabel()` - 20 edges
10. `AdminTabs()` - 18 edges

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
Cohesion: 0.24
Nodes (8): ALL_PLATFORMS, clearClientToken(), getClientToken(), auth(), ClientCampaign, ClientSubmission, listClientCampaigns(), listClientSubmissions()

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (47): AccountPage(), LoadingCover(), SocialEmbed(), METHOD_LABEL, METHODS, SubmissionDetailModal(), PLATFORMS, STATUSES (+39 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (44): CardInner(), CampaignCard(), CardInner(), ALL_PLATFORMS, CampaignsPage(), Sort, SORTS, CampaignSearchModal() (+36 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (9): AuthCard(), POINTS, peekInvite(), adminLogin(), creatorSignup(), setAdminToken(), Button(), ButtonProps (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (22): AdminShell(), AdminTabs(), BannerInput(), ImageCropModal(), AdminIndex(), Pager(), windowed(), SharePageLink() (+14 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (31): addPortfolio(), addSocial(), confirmSocialVerify(), CREATOR_TYPES, CreatorType, deletePortfolio(), deleteSocial(), EDUCATION_LEVELS (+23 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (23): addWalletFunds(), downloadPayoutReportsCsv(), ForecastRow, getForecast(), getLedger(), getSpendingSummary(), getWallet(), LedgerRow (+15 more)

### Community 7 - "Community 7"
Cohesion: 0.17
Nodes (11): AddExperienceModal(), EMPTY, Form, KINDS, addExperience(), EXPERIENCE_DELIVERABLES, EXPERIENCE_NICHES, EXPERIENCE_PLATFORMS (+3 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (31): NotificationDrawer(), API_URL, CompletionOut, ContractDetail, ContractSummary, CreatorListItem, ExperienceIn, ExperienceItem (+23 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (36): InviteCreatorModal(), AdminAnalytics, AdminCampaign, AdminClient, AdminStats, ApplicantFilters, ApplicantSocial, ApplicantUpdateIn (+28 more)

### Community 10 - "Community 10"
Cohesion: 0.07
Nodes (41): AdminMessagesLauncher(), AdminNotificationsLauncher(), AdminSidebar(), CreatorLayout(), CreatorSidebar(), CreatorTopbar(), AdminNotification, getUnreadCount() (+33 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (34): NewCampaignModal(), Stage, CampaignDetailPage(), BonusMilestone, CampaignCreate, PaymentType, CAMPAIGN_KINDS, CampaignKind (+26 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (47): adminListNotifications(), adminUploadImage(), archiveCampaign(), auth(), closeCampaign(), convertCampaignToAdvanced(), createCampaign(), deleteSubmission() (+39 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (6): NAV, NAV, NavItem, clearAdminToken(), clearAuthToken(), LuminaMark()

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (11): creatorCheckEmail(), CreatorCheckEmailResult, creatorLogin(), CreatorLoginResult, creatorSetPassword(), CreatorSetPasswordResult, setAuthToken(), SignupResult (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.10
Nodes (14): COLUMNS, ExportCreatorsModal(), AdminCreatorsPage(), EMPTY, Prefs, RANK_STYLE, useDebounced(), downloadCreatorsCsv() (+6 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (21): addressFor(), DETAIL_LABEL, LABEL, METHODS, PayCreatorModal(), MODES, RemoveCreatorModal(), SCOPES (+13 more)

### Community 17 - "Community 17"
Cohesion: 0.05
Nodes (33): PLATFORM_LABELS, TabKey, TABS, ALL_PLATFORMS, MODE_LABEL, ContractDocument(), DAYS, MILESTONES (+25 more)

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (6): ORDER, ProfileGateModal(), SECTION_LABEL, SECTION_STEP, getCompletion(), ProfileSection

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (8): HELP, LABEL, PayoutDetailsCard(), PLACEHOLDER, PAYOUT_METHODS, PayoutMethod, ProfileOut, updateProfile()

### Community 21 - "Community 21"
Cohesion: 0.40
Nodes (3): metadata, serif, Providers()

### Community 22 - "Community 22"
Cohesion: 0.07
Nodes (28): Avatar(), COUNTRY_FLAGS, CreatorDetailCard(), flagFor(), fmtMoney(), fmtNumber(), PLATFORM_GRADIENT, AdminApplicantsPage() (+20 more)

### Community 24 - "Community 24"
Cohesion: 0.22
Nodes (8): PLATFORMS, TopVideosTab(), VideoCard(), addTopVideo(), listTopVideos(), refreshTopVideo(), TopVideoOut, TopVideoPlatform

### Community 26 - "Community 26"
Cohesion: 0.22
Nodes (6): createUser(), editClient(), getUsers(), listAdminCampaigns(), reactivateClient(), suspendClient()

### Community 27 - "Community 27"
Cohesion: 0.22
Nodes (7): AddCreatorsToCampaignModal(), Tab, CampaignInviteSummary, CreatorRow, getCampaignInviteLink(), inviteToCampaign(), listCreators()

### Community 28 - "Community 28"
Cohesion: 0.25
Nodes (4): resendEmailCode(), verifyEmailCode(), FieldProps, InfoTip()

### Community 30 - "Community 30"
Cohesion: 0.33
Nodes (4): STATUS_LABEL, STATUS_STYLE, ContractStatus, listMyContracts()

### Community 31 - "Community 31"
Cohesion: 0.67
Nodes (3): listCreatorPendingCampaigns(), updateApplicant(), CampaignApprovalBar()

### Community 33 - "Community 33"
Cohesion: 0.50
Nodes (3): disableShareToken(), enableShareToken(), rotateShareToken()

## Knowledge Gaps
- **183 isolated node(s):** `PLATFORM_LABEL`, `TabKey`, `TABS`, `ALL_PLATFORMS`, `PLATFORM_LABEL` (+178 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiFetch()` connect `Community 12` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 19`, `Community 20`, `Community 22`, `Community 24`, `Community 26`, `Community 27`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 33`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `fmtInt()` connect `Community 1` to `Community 0`, `Community 2`, `Community 4`, `Community 6`, `Community 11`, `Community 16`, `Community 17`, `Community 22`, `Community 24`, `Community 26`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `fmtMoney()` connect `Community 1` to `Community 2`, `Community 4`, `Community 6`, `Community 11`, `Community 16`, `Community 17`, `Community 22`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `fmtInt()` (e.g. with `AdminDashboardPage()` and `DashboardInner()`) actually correct?**
  _`fmtInt()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PLATFORM_LABEL`, `TabKey`, `TABS` to the rest of the system?**
  _183 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06458941901979877 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.061581920903954805 - nodes in this community are weakly interconnected._