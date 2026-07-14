# Graph Report - lumina-creators-app/frontend/src  (2026-07-14)

## Corpus Check
- 127 files · ~95,736 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 828 nodes · 2172 edges · 46 communities (42 shown, 4 thin omitted)
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
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 151 edges
2. `auth()` - 74 edges
3. `fmtInt()` - 43 edges
4. `fmtMoney()` - 37 edges
5. `getAdminToken()` - 36 edges
6. `getAuthToken()` - 26 edges
7. `isAuthError()` - 25 edges
8. `platformLabel()` - 21 edges
9. `AdminShell()` - 20 edges
10. `AdminTabs()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `AdminCreatorDetailPage()` --calls--> `fmtInt()`  [INFERRED]
  app/(admin)/admin/creators/[id]/page.tsx → lib/format.ts
- `CreatorRow()` --calls--> `fmtInt()`  [INFERRED]
  app/(admin)/admin/campaigns/[id]/page.tsx → lib/format.ts
- `CampaignDetailPage()` --calls--> `campaignImage()`  [INFERRED]
  app/(admin)/admin/campaigns/[id]/page.tsx → lib/campaignTheme.ts
- `CampaignDetailPage()` --calls--> `fmtInt()`  [INFERRED]
  app/(admin)/admin/campaigns/[id]/page.tsx → lib/format.ts
- `AdminPaymentsPage()` --calls--> `fmtMoney()`  [EXTRACTED]
  app/(admin)/admin/payments/page.tsx → lib/format.ts

## Import Cycles
- None detected.

## Communities (46 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.16
Nodes (13): CampaignExamplesSection(), SharePageLink(), SubmissionDetailModal(), PLATFORMS, STATUSES, SubmissionsSection(), AdminDashboardPage(), DashboardInner() (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (47): ALL_PLATFORMS, CardInner(), MODE_LABEL, CampaignCard(), CardInner(), CampaignModal(), ALL_PLATFORMS, CampaignsPage() (+39 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (24): DAYS, MILESTONES, ApiError, finalizeUpload(), getProfile(), listMyCampaigns(), presignUpload(), putToPresignedUrl() (+16 more)

### Community 3 - "Community 3"
Cohesion: 0.18
Nodes (8): peekInvite(), creatorSignup(), resendEmailCode(), verifyEmailCode(), Button(), ButtonProps, Field(), FieldProps

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (7): AdminShell(), AdminTabs(), StatusBadge(), STYLES, reactivateClient(), suspendClient(), getAdminToken()

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (31): addPortfolio(), addSocial(), confirmSocialVerify(), CREATOR_TYPES, CreatorType, deletePortfolio(), deleteSocial(), EDUCATION_LEVELS (+23 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (25): addWalletFunds(), downloadPayoutReportsCsv(), ForecastRow, getForecast(), getLedger(), getSpendingSummary(), getWallet(), LedgerRow (+17 more)

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (13): AddExperienceModal(), EMPTY, Form, KINDS, addExperience(), EXPERIENCE_DELIVERABLES, EXPERIENCE_NICHES, EXPERIENCE_PLATFORMS (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (27): API_URL, CompletionOut, ContractDetail, ContractSummary, CreatorListItem, ExperienceIn, ExperienceItem, Health (+19 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (37): InviteCreatorModal(), AdminAnalytics, AdminCampaign, AdminClient, AdminStats, ApplicantFilters, ApplicantSocial, ApplicantUpdateIn (+29 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (33): PendingReview, addChannelMembers(), base(), ChannelMember, channelMembers(), composeEmail(), contractHistory(), ContractHistoryItem (+25 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (37): BannerInput(), ImageCropModal(), NewCampaignModal(), Stage, CampaignDetailPage(), BonusMilestone, CampaignCreate, PaymentType (+29 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (50): adminListNotifications(), adminUploadImage(), archiveCampaign(), auth(), closeCampaign(), convertCampaignToAdvanced(), createCampaign(), createUser() (+42 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (6): CreatorLayout(), CreatorSidebar(), NAV, NavItem, CreatorTopbar(), clearAuthToken()

### Community 14 - "Community 14"
Cohesion: 0.19
Nodes (6): creatorCheckEmail(), creatorLogin(), creatorSetPassword(), setAuthToken(), Step, Mode

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (10): AdminCreatorsPage(), EMPTY, Prefs, RANK_STYLE, useDebounced(), CreatorFilters, Gender, GENDERS (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.27
Nodes (6): ChartTooltip(), ViewsGrowthChart(), ViewsPoint, WeeklyPostChart(), WeeklyPostPoint, AdminCreatorDetailPage()

### Community 17 - "Community 17"
Cohesion: 0.15
Nodes (8): PLATFORM_LABELS, TabKey, TABS, AWARD_META, AwardRow(), StreakFlame(), deleteExperience(), listExperiences()

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
Cohesion: 0.19
Nodes (11): COUNTRY_FLAGS, CreatorDetailCard(), flagFor(), fmtMoney(), fmtNumber(), PLATFORM_GRADIENT, nextRankInfo(), getCreatorRichDetail() (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.14
Nodes (13): NotificationDrawer(), PLATFORMS, TopVideosTab(), VideoCard(), addTopVideo(), listNotifications(), listTopVideos(), markNotificationsRead() (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.08
Nodes (24): COLUMNS, ExportCreatorsModal(), LoadingCover(), SocialEmbed(), METHOD_LABEL, METHODS, ALL_PLATFORMS, downloadCreatorsCsv() (+16 more)

### Community 27 - "Community 27"
Cohesion: 0.22
Nodes (7): AddCreatorsToCampaignModal(), Tab, CampaignInviteSummary, CreatorRow, getCampaignInviteLink(), inviteToCampaign(), listCreators()

### Community 28 - "Community 28"
Cohesion: 0.17
Nodes (12): AccountPage(), addressFor(), DETAIL_LABEL, LABEL, METHODS, PayCreatorModal(), AdminAnalyticsPage(), PLATFORM_LABEL (+4 more)

### Community 29 - "Community 29"
Cohesion: 0.25
Nodes (7): RankBadge(), getUnreadCount(), AwardKey, CreatorGamification, GemstoneRank, getMyGamification(), KNOWN_AWARDS

### Community 30 - "Community 30"
Cohesion: 0.14
Nodes (9): ContractDocument(), STATUS_LABEL, STATUS_STYLE, ContractTemplate, acceptContract(), ContractStatus, getContract(), listMyContracts() (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.19
Nodes (9): Avatar(), AdminApplicantsPage(), TabKey, TABS, useDebounced(), ApplicantCounts, ApplicantDetail, ApplicantListItem (+1 more)

### Community 32 - "Community 32"
Cohesion: 0.18
Nodes (8): CreatorRichDetail, deleteTopVideo(), getMyPortfolio(), hostOf(), logoFor(), normUrl(), PLATFORM_GRADIENT, ThumbImage()

### Community 33 - "Community 33"
Cohesion: 0.50
Nodes (3): disableShareToken(), enableShareToken(), rotateShareToken()

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (7): AdminMessagesLauncher(), AdminNotificationsLauncher(), AdminSidebar(), NAV, AdminNotification, clearAdminToken(), LuminaMark()

### Community 35 - "Community 35"
Cohesion: 0.29
Nodes (4): getPublicReport(), PublicReport, PublicReportSubmission, PublicReportPage()

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (7): adminLogin(), CreatorCheckEmailResult, CreatorLoginResult, CreatorSetPasswordResult, setAdminToken(), SignupResult, TokenResult

### Community 38 - "Community 38"
Cohesion: 0.25
Nodes (6): AdminSubmission, listSubmissions(), initials(), MODE_LABEL, TABS, VideoCard()

### Community 39 - "Community 39"
Cohesion: 0.25
Nodes (4): AuthCard(), POINTS, clientLogin(), setClientToken()

### Community 40 - "Community 40"
Cohesion: 0.25
Nodes (6): MODES, RemoveCreatorModal(), SCOPES, RemovalMode, RemovalScope, removeCreator()

### Community 41 - "Community 41"
Cohesion: 0.29
Nodes (5): GemstoneRank, RANK_ORDER, RANK_STYLES, RANK_THRESHOLDS, XpBar()

### Community 42 - "Community 42"
Cohesion: 0.29
Nodes (4): ALL_PLATFORMS, FormState, PLATFORM_LABEL, CampaignUpdate

### Community 43 - "Community 43"
Cohesion: 0.50
Nodes (3): addCampaignExample(), deleteCampaignExample(), listCampaignExamples()

### Community 45 - "Community 45"
Cohesion: 0.67
Nodes (3): listCreatorPendingCampaigns(), updateApplicant(), CampaignApprovalBar()

## Knowledge Gaps
- **186 isolated node(s):** `PLATFORM_LABEL`, `TabKey`, `TABS`, `ALL_PLATFORMS`, `PLATFORM_LABEL` (+181 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiFetch()` connect `Community 12` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 14`, `Community 15`, `Community 17`, `Community 19`, `Community 20`, `Community 22`, `Community 24`, `Community 26`, `Community 27`, `Community 29`, `Community 30`, `Community 32`, `Community 33`, `Community 35`, `Community 36`, `Community 38`, `Community 39`, `Community 40`, `Community 43`, `Community 45`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `fmtInt()` connect `Community 0` to `Community 32`, `Community 1`, `Community 2`, `Community 35`, `Community 4`, `Community 6`, `Community 38`, `Community 11`, `Community 16`, `Community 17`, `Community 24`, `Community 26`, `Community 28`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `fmtMoney()` connect `Community 28` to `Community 0`, `Community 1`, `Community 2`, `Community 32`, `Community 4`, `Community 37`, `Community 6`, `Community 42`, `Community 11`, `Community 16`, `Community 17`, `Community 26`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `fmtInt()` (e.g. with `AdminDashboardPage()` and `DashboardInner()`) actually correct?**
  _`fmtInt()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PLATFORM_LABEL`, `TabKey`, `TABS` to the rest of the system?**
  _186 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06034801925212884 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11182795698924732 - nodes in this community are weakly interconnected._