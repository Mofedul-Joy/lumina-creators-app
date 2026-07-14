# Graph Report - lumina-creators-app/frontend/src  (2026-07-14)

## Corpus Check
- 126 files · ~94,404 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 817 nodes · 2136 edges · 40 communities (37 shown, 3 thin omitted)
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

## God Nodes (most connected - your core abstractions)
1. `apiFetch()` - 147 edges
2. `auth()` - 70 edges
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
- `AdminDashboardPage()` --calls--> `fmtInt()`  [INFERRED]
  app/(admin)/admin/dashboard/page.tsx → lib/format.ts

## Import Cycles
- None detected.

## Communities (40 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.18
Nodes (11): ALL_PLATFORMS, DashboardInner(), clearClientToken(), getClientToken(), setClientToken(), auth(), ClientCampaign, ClientSubmission (+3 more)

### Community 1 - "Community 1"
Cohesion: 0.15
Nodes (22): AccountPage(), CampaignModal(), AdminCampaignDetailPage(), CreatorRow(), publicApi, AGE_REQUIREMENT_LABEL, PAYMENT_TYPE_LABEL, PaymentFields (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (34): ALL_PLATFORMS, CampaignsPage(), Sort, SORTS, CampaignSearchModal(), SUGGESTED, ApiError, finalizeUpload() (+26 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (12): AuthCard(), peekInvite(), clientLogin(), creatorSignup(), resendEmailCode(), setAuthToken(), verifyEmailCode(), Button() (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (29): AdminShell(), AdminTabs(), BannerInput(), ImageCropModal(), AdminIndex(), Pager(), windowed(), SharePageLink() (+21 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (27): addSocial(), confirmSocialVerify(), CREATOR_TYPES, CreatorType, deletePortfolio(), deleteSocial(), EDUCATION_LEVELS, EducationLevel (+19 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (20): addWalletFunds(), ForecastRow, getForecast(), getLedger(), getWallet(), LedgerRow, listOwedV2(), OwedRowV2 (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (13): AddExperienceModal(), EMPTY, Form, KINDS, addExperience(), EXPERIENCE_DELIVERABLES, EXPERIENCE_NICHES, EXPERIENCE_PLATFORMS (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (34): addPortfolio(), API_URL, CompletionOut, ContractDetail, ContractSummary, CreatorListItem, ExperienceIn, ExperienceItem (+26 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (35): AdminAnalytics, AdminCampaign, AdminClient, AdminStats, ApplicantFilters, ApplicantSocial, ApplicantUpdateIn, ApplicantVideo (+27 more)

### Community 10 - "Community 10"
Cohesion: 0.10
Nodes (32): addChannelMembers(), base(), ChannelMember, channelMembers(), composeEmail(), contractHistory(), ContractHistoryItem, Conversation (+24 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (34): NewCampaignModal(), Stage, CampaignDetailPage(), BonusMilestone, CampaignCreate, PaymentType, CAMPAIGN_KINDS, CampaignKind (+26 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (48): adminListNotifications(), adminUploadImage(), archiveCampaign(), auth(), closeCampaign(), convertCampaignToAdvanced(), createCampaign(), createInvite() (+40 more)

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (4): CreatorSidebar(), NAV, NavItem, clearAuthToken()

### Community 14 - "Community 14"
Cohesion: 0.24
Nodes (5): creatorCheckEmail(), creatorLogin(), creatorSetPassword(), Step, Mode

### Community 15 - "Community 15"
Cohesion: 0.10
Nodes (14): COLUMNS, ExportCreatorsModal(), InviteCreatorModal(), AdminCreatorsPage(), EMPTY, Prefs, RANK_STYLE, useDebounced() (+6 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (20): addressFor(), DETAIL_LABEL, LABEL, METHODS, PayCreatorModal(), MODES, RemoveCreatorModal(), SCOPES (+12 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (14): PLATFORM_LABELS, TabKey, TABS, AWARD_META, AwardRow(), GemstoneRank, RANK_ORDER, RANK_STYLES (+6 more)

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
Cohesion: 0.20
Nodes (9): PLATFORMS, TopVideosTab(), VideoCard(), addTopVideo(), deleteTopVideo(), listTopVideos(), refreshTopVideo(), TopVideoOut (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.16
Nodes (16): LoadingCover(), SocialEmbed(), METHOD_LABEL, METHODS, SubmissionDetailModal(), PLATFORMS, STATUSES, AdminSubmission (+8 more)

### Community 27 - "Community 27"
Cohesion: 0.22
Nodes (7): AddCreatorsToCampaignModal(), Tab, CampaignInviteSummary, CreatorRow, getCampaignInviteLink(), inviteToCampaign(), listCreators()

### Community 28 - "Community 28"
Cohesion: 0.13
Nodes (12): ALL_PLATFORMS, CardInner(), MODE_LABEL, CampaignCard(), CardInner(), PublicCampaign, campaignImage(), campaignTag() (+4 more)

### Community 29 - "Community 29"
Cohesion: 0.20
Nodes (10): CreatorLayout(), CreatorTopbar(), NotificationDrawer(), getUnreadCount(), getAuthToken(), AwardKey, CreatorGamification, GemstoneRank (+2 more)

### Community 30 - "Community 30"
Cohesion: 0.16
Nodes (8): STATUS_LABEL, STATUS_STYLE, DAYS, MILESTONES, ContractStatus, getProfile(), listMyContracts(), Skeleton()

### Community 31 - "Community 31"
Cohesion: 0.12
Nodes (16): Avatar(), AdminApplicantsPage(), TabKey, TABS, useDebounced(), ApplicantCounts, ApplicantDetail, ApplicantListItem (+8 more)

### Community 32 - "Community 32"
Cohesion: 0.19
Nodes (7): CreatorRichDetail, getMyPortfolio(), hostOf(), logoFor(), normUrl(), PLATFORM_GRADIENT, ThumbImage()

### Community 33 - "Community 33"
Cohesion: 0.50
Nodes (3): disableShareToken(), enableShareToken(), rotateShareToken()

### Community 34 - "Community 34"
Cohesion: 0.20
Nodes (6): AdminMessagesLauncher(), AdminNotificationsLauncher(), AdminSidebar(), NAV, AdminNotification, clearAdminToken()

### Community 35 - "Community 35"
Cohesion: 0.20
Nodes (7): getPublicReport(), PublicReport, PublicReportSubmission, PublicReportPage(), LABELS, PATHS, PlatformIcon()

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (7): adminLogin(), CreatorCheckEmailResult, CreatorLoginResult, CreatorSetPasswordResult, setAdminToken(), SignupResult, TokenResult

### Community 37 - "Community 37"
Cohesion: 0.33
Nodes (3): ContractDocument(), acceptContract(), getContract()

### Community 38 - "Community 38"
Cohesion: 0.33
Nodes (4): initials(), MODE_LABEL, TABS, VideoCard()

## Knowledge Gaps
- **184 isolated node(s):** `PLATFORM_LABEL`, `TabKey`, `TABS`, `ALL_PLATFORMS`, `PLATFORM_LABEL` (+179 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiFetch()` connect `Community 12` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 14`, `Community 15`, `Community 16`, `Community 17`, `Community 19`, `Community 20`, `Community 22`, `Community 24`, `Community 26`, `Community 27`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 33`, `Community 35`, `Community 36`, `Community 37`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `fmtInt()` connect `Community 1` to `Community 0`, `Community 32`, `Community 2`, `Community 35`, `Community 4`, `Community 6`, `Community 38`, `Community 11`, `Community 16`, `Community 17`, `Community 24`, `Community 26`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `fmtMoney()` connect `Community 1` to `Community 32`, `Community 2`, `Community 4`, `Community 6`, `Community 11`, `Community 16`, `Community 17`, `Community 26`, `Community 28`, `Community 30`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `fmtInt()` (e.g. with `AdminDashboardPage()` and `DashboardInner()`) actually correct?**
  _`fmtInt()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PLATFORM_LABEL`, `TabKey`, `TABS` to the rest of the system?**
  _184 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1495798319327731 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07928118393234672 - nodes in this community are weakly interconnected._