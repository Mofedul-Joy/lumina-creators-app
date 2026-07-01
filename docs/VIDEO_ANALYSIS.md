# Lumina Creators App — Video Analysis & Project Brief

> **Source video:** Loom — https://www.loom.com/share/1a06baaedeef4a5493eb8fcf1da4dce7
> **Duration:** ~14:10 · **Speaker:** Rhys (Lumina founder), briefing the developer
> **Method:** Full video downloaded, 100 frames extracted (ffmpeg scene-aware), every frame read and aligned to the user-supplied transcript.
> **Reference frames:** `docs/reference-frames/` (22 curated screenshots pulled from the video)

This document is the source-of-truth interpretation of what Rhys asked for. It combines **what he said** (transcript) with **what he showed on screen** (frames). Where the two reinforce each other it is noted.

---

## 1. TL;DR — what we're building

A brand-new **creator app for Lumina** (the "Lumina Creators App"). Lumina already runs a live *clipping* platform (Lumina Clippers); this new app extends the model to a **full UGC-creator operation** with two clearly separated surfaces:

1. **Creator-facing app** — creators sign up, build a rich profile, browse Lumina's campaigns, and choose to participate. Two campaign modes: **create new UGC** (higher pay) vs **upload existing content** (copy/paste, lower pay).
2. **Admin app (Lumina only)** — a private, **Collabstr-style filterable creator database** with drill-down profiles, plus a **campaign builder** to launch unlimited unique campaigns of either mode.

The single most important framing Rhys repeats: **"You're building the ship, and we are the captains who decide which direction it turns."** We build the *system/CMS*, not individual campaigns. It must handle 1 campaign or 100, each unique.

**Hard business rule:** this is a **closed, service-based marketplace**. Unlike Collabstr, **no external brand can self-serve**. Brands must book a call with Lumina; only Lumina admins launch campaigns. Creators never see brands; brands never see creators.

---

## 2. Context — Collabstr is the *reference*, not the product

Rhys spends much of the video inside **Collabstr** (collabstr.com), a public UGC/influencer marketplace. He is explicit at ~05:51:

> "I'm not trying to replicate Collabstr, I'm just using this as an example."

Collabstr is used purely to point at **UX patterns** he wants. What Collabstr is (and why Lumina differs):

- Collabstr = open marketplace. Anyone can sign up as a **creator**, any **brand** can sign up and hire creators like "Fiverr but only for UGC" (~06:22).
- Lumina = **fully service-based**. "No company or brand can come here and steal our creators… only we can launch campaigns, which the creators can see" (~06:40–07:23). Brands "have to book a call with us. You cannot launch a campaign" (~07:23).

### Collabstr patterns Rhys wants (with frame refs)
| Pattern | What it looks like | Frame(s) |
|---|---|---|
| Campaign/creator **cards** | Rounded thumbnail, **price/payout badge top-right** ($150/$400/$300/$200), name, rating, short testimonial tag ("great to work with") | `collabstr-01`, `collabstr-04`, `collabstr-05` |
| **Creator profile** | Hero photo grid + "Show All Photos", name + ★rating + review count, location, **social follower counts** (IG/TikTok), "Top Creator" / "Responds Fast" badges, package + price ("1 Instagram Photo Feed Post — $150"), portfolio of past brand videos, bio/description | `collabstr-06`, `collabstr-07` |
| **Filterable database** | Grid of creators with filter chips: Platform, Category, **Location, Price, Gender, Age, Ethnicity, Language**, Clear All | `collabstr-10` |
| Filter modals | Location (country/region/city search), Price (min/max slider $50–$3,000+) | `collabstr-11`, `collabstr-12` |
| Demographic filters are **paywalled** on Collabstr | "Upgrade to Unlock Advanced Filters including **age, ethnicity, languages**" | `collabstr-13` |
| Signup gate | "Sign Up to View Social Media Profiles" | `collabstr-08` |

> **Insight:** The exact demographic filters Rhys wants (age, gender, ethnicity, language) are the ones Collabstr hides behind a paywall (`collabstr-13`). Lumina wants these **native and free for admins** — it's a core admin feature, not an afterthought.

---

## 3. The existing Lumina Clippers platform (what already exists)

Rhys contrasts Collabstr against Lumina's **current** live platform to show "a similar flow." Visual identity is **dark green / near-black with bright green accents** (`#22c55e`), the opposite of Collabstr's light/pink theme.

### 3a. Public marketing site — `luminaclippers.com` (`lumina-01`)
- Headline: *"The clipping agency for brands that want predictable virality."*
- CTA: **Book a Strategy Call**. Nav: What We Do, Case Studies, Blog, Contact. Banner: "Want to become a UGC creator? Apply now!"
- This is the brand-facing funnel → brands book calls, they never self-serve.

### 3b. Creator/clipper portal — `portal.luminaclippers.com` (`lumina-02`, `lumina-03`, `lumina-04`)
- **Dashboard:** big "Total Paid Out" counter (~$268,209 → ticking up across frames), "User Tutorial Walkthrough", "Join our Discord", **Active Campaigns** as cards, **Claim Payouts** button.
- **Campaign cards:** brand logo (VIBECON, Midjourney, Casino Reactions, Candy AI), **budget** ($5,000 / $7,500 / $1,500), **CPM** ($0.75 / $1 CPM), "**Pre-made clips**" label, campaign-budget progress bar, **ENTER CAMPAIGN** button.
- **Campaign detail** (`lumina-04`): budget/CPM/platforms (Instagram, TikTok, YouTube, Facebook, X), "Anyone can enter", **Submit Your Clip** form (paste URL) + **SUBMIT CLIP**, **VIEW REQUIREMENTS**, Discord.

### 3c. Campaign brief = a Google Doc (`lumina-05`) — how campaigns actually work today
The "VIEW REQUIREMENTS" link opens a Google Doc. The Midjourney example shows the real structure:
- **Title + rate:** "Midjourney CLIPPING CAMPAIGN — $1 CPM"
- **Guidelines:** pays $1 per 1,000 views; platforms IG Reels / YT Shorts / TikTok; keep videos up ≥30 days or you won't be paid on future campaigns.
- **Caption rules (do not break):** no medical claims; respect the founder (limit face time ~25%, lean on b-roll); no bad PR / clickbait.
- **Clips ready to upload:** *"Use the approved clips at: `https://drive.google.com/drive/.../folders/...`"* — **a Google Drive folder of pre-made clips to copy** — this is the concrete "upload existing" mechanism.
- **Posting requirements:** must mention "Midjourney" in caption; tell the founder/launch story accurately.
- **5 caption examples.**

> **Insight:** The new campaign builder should capture these brief fields as structured data (rate, platforms, min-retention, caption rules, mention requirements, **Drive link for copy campaigns**, example captions) rather than a free Google Doc.

### 3d. Admin portal — `portal.luminaclippers.com/0x8f3a…` (obfuscated admin path)
- **New Campaign form** (`lumina-06`): Campaign Name, Client Name/Email/Contact, CPM, Max Payout, Max Budget, Campaign Slug/ID, target/deploy fields, and a **"Geo View Settings"** section with country toggles (United States, United Kingdom, Ireland, Canada, Australia, New Zealand, Germany, Denmark, Netherlands, Sweden, …).
- **User Management** (`lumina-07`): a table of users (name/email/handle columns), **ADD USER** button. This is the *bare* version of what Rhys wants upgraded into a rich, filterable creator database.

> Admins create campaigns here → they go live on the creator dashboard. Rhys: "It should be a similar flow" for the new app (~03:18).

---

## 4. The NEW app — detailed requirements

### 4.1 Two audiences, one system
- **Creators (UGC creators):** sign up, build profile, browse & enter campaigns, get paid.
- **Admins (Lumina, "the captains"):** manage the creator database, build & launch/delete campaigns, decide what content is allowed.

No brand/client self-serve surface in this app. (Brands stay on the marketing site + calls.)

### 4.2 Creator-facing side

**A. Onboarding / mandatory profile** (~04:00–05:36, "this is mandatory")
Every creator who signs up **must** create a profile that admins can later view. Required fields:
- Name, email, profile picture
- **Social media handles** (clickable → opens their socials), with follower counts
- A short **description/bio**
- **Uploads of previous videos** they've made for past brands/clients (portfolio)
- Demographic attributes used for admin filtering: **age, gender, ethnicity, language** (+ location)

Visual model = the Collabstr creator profile (`collabstr-06`, `collabstr-07`): photo grid, name+rating, follower counts, "past work" portfolio, bio.

**B. Campaign browse** (~00:53–01:20)
Creators see all **available** campaigns and choose which to enter. Each campaign card shows the deciding info: **CPM, payout, budget**, platform(s), and a way to enter. Same concept as the current Lumina dashboard (`lumina-03`) but redesigned, and as Collabstr's card grid (`collabstr-01`).

**C. The two campaign modes — the core split** (~01:35–02:27, ~10:56–11:44)
Rhys describes a screen "split in half":

- **LEFT — "Create new videos (UGC)"** → *creation required*.
  - Creator is given a **script/brief** (e.g. "create a video in the street with a microphone interviewing people about this brand").
  - They film **original** content and upload to **their own** social media.
  - **Higher paying** (more work).

- **RIGHT — "Upload existing posts (no creation)"** → *no creation*.
  - Creator gets access to provided content (e.g. a **Google Drive** folder of approved clips — see `lumina-05`).
  - They **download → copy/paste → post** to their socials.
  - **Lower paying** (less work). This is essentially today's "clipping / pre-made clips" flow.

> Every campaign belongs to one of these two categories. Admins choose the mode per campaign.

**D. Earn / payouts**
Consistent with the existing platform: CPM-based earnings on tracked views, claim payouts. (Existing Lumina Clippers API already handles submissions, view-scraping, CPM earnings, and payouts — see `lumina-snapshot-earlier-2026/CONTEXT.md`.)

### 4.3 Admin side

**A. Creator database** (~04:00–04:46, ~09:16–10:11) — *private, never public*
- A **huge, filterable table/grid of every creator** who signs up.
- **Filters:** age, gender, ethnicity, language (and location, platform, followers) — the Collabstr filter set (`collabstr-10`), but the demographic ones are **native and free** (Collabstr paywalls them, `collabstr-13`).
- **Drill-down:** click a creator → full profile: social handles (clickable), follower counts, sample of previous posts/videos, description, name, email.
- This upgrades the current bare **User Management** table (`lumina-07`).

**B. Campaign builder** (~02:27–03:28, ~10:11–12:45) — "build the ship"
- **Post/create a campaign** with: description of what the campaign should look like, **payout/CPM**, **platform(s)** required, and **content mode** (create-new vs copy/paste).
- For **copy campaigns:** attach the **Google Drive** link of approved content.
- For **create campaigns:** provide the **script/brief**.
- Admin controls **what content creators can and cannot post** ("we determine what goes live… we can say this campaign has to be only for this text").
- **Full CRUD:** create, edit, **delete** campaigns.
- **Unlimited unique campaigns:** "one campaign or a hundred… each campaign could be different" (~12:30). The current platform already has ~51 distinct campaigns (~13:32) — proof it must be a reusable engine, "not a software for one video or one company" (~13:43).
- On publish → campaign appears on the creator dashboard (`lumina-03`), same flow as today.

### 4.4 Explicit non-goals / boundaries
- ❌ No brand/client self-serve. Brands book calls; admins launch on their behalf. Brands "never get to see the process" (~08:39).
- ❌ Not building specific campaigns — building the **system** that lets admins build campaigns (~12:59, ~13:53).
- ❌ Not a Collabstr clone — borrow UX only.

---

## 5. Feature checklist (build backlog)

**Creator app**
- [ ] Auth: signup + login (creators only)
- [ ] Mandatory profile builder: name, email, avatar, bio, **socials + follower counts**, **demographics (age/gender/ethnicity/language/location)**, **portfolio video uploads**
- [ ] Campaign browse (cards: CPM, payout, budget, platforms)
- [ ] Campaign detail with the **two modes**:
  - [ ] Create-new: show script/brief, rules, required mentions, example captions
  - [ ] Copy/paste: show provided clips (Google Drive), download → post
- [ ] Enter/participate + submit posted URL
- [ ] Earnings + claim payouts (CPM on tracked views)

**Admin app**
- [ ] Auth (admin, protected path)
- [ ] **Creator database**: filterable grid (age, gender, ethnicity, language, location, platform, followers) — free/native
- [ ] Creator drill-down profile (socials, followers, past posts, bio)
- [ ] **Campaign builder** (CRUD): description, payout/CPM, platforms, **content mode**, script (create) / Drive link (copy), allowed-content rules, geo-targeting
- [ ] Publish → appears on creator dashboard; delete/edit
- [ ] Payout management

**System / cross-cutting**
- [ ] Closed marketplace enforcement (no brand self-serve)
- [ ] Lumina dark-green design system (`#22c55e` on near-black) + Collabstr-grade card/profile/filter UX
- [ ] Reuse or extend existing Lumina Clippers API where possible (auth, submissions, view-scraping, CPM, payouts)

---

## 6. Design direction

Fuse the two worlds seen in the video:
- **Structure/UX from Collabstr:** clean cards, price badges, rich creator profiles, filter chips + modals, database grid.
- **Skin/brand from Lumina Clippers:** dark theme, near-black → zinc, **green-500 accent**, mono numerals. (Full token list in `lumina-snapshot-earlier-2026/CONTEXT.md` §8.)

Deliver a database/campaign UX as polished as Collabstr's, but on Lumina's dark-green brand and behind Lumina's closed, admin-only campaign engine.

---

## 7. Open questions to confirm with Rhys before/while building

1. **Stack:** Web (Next.js, matches existing Lumina frontend) vs mobile (Expo, per existing CONTEXT.md mobile plan) vs web-first-then-mobile? Admin is clearly web.
2. **Backend:** reuse the existing `lumina-clippers-api.onrender.com` (extend with UGC-create campaigns + demographic profile fields) vs a fresh backend vs mock-first?
3. **Which side first:** creator-facing, admin, or shared foundation (design system + auth + API client) first?
4. **Profile demographics:** self-reported by creators at signup, or admin-entered/verified?
5. **"Create-new" verification:** how is original UGC proven (proof video upload already exists for clips)?
6. **Relationship to the existing live portal:** is this a *replacement* for the current creator dashboard or a *separate* new app running alongside it?

---

## 8. Frame → timestamp index (for re-verification)

Key moments (absolute video time; frames in `docs/reference-frames/` unless noted, raw frames in the watch work dir):
- **00:00–00:53** Rhys logging into Collabstr; intro (`00_loom-library`, raw f1–f8)
- **00:53–01:20** "view all campaigns… CPM, payout, budget" — Collabstr card grid (`collabstr-01`, `collabstr-04`)
- **01:20–02:27** the split-screen concept: create-new UGC (L) vs upload-existing/no-creation (R)
- **02:27–03:28** owner/admin standpoint: "we determine what they can post"; current campaign create → goes live flow
- **04:00–05:36** admin sees all creators; mandatory creator profiles (socials, past videos); private DB (`collabstr-06`)
- **05:51–07:23** Collabstr explainer + the closed/service-based distinction (`collabstr-01`, `lumina-01`)
- **07:33–09:16** brand page = book-a-call; current faceless-creator campaigns + bare creator DB (`lumina-02`, `lumina-03`)
- **09:16–10:11** the wanted DB with filters: age, gender, ethnicity, language (`collabstr-10`, `collabstr-11`, `collabstr-12`, `collabstr-13`)
- **10:11–11:44** launch a campaign (description, pay, platforms) + the two campaign options again; Drive for copy (`lumina-05`)
- **11:44–13:43** "build the ship"; unlimited unique campaigns; ~51 campaigns already exist
- **13:43–14:10** wrap: "you build the system, not the campaign"

---

*Analysis produced from the actual video: 47 MB Loom MP4 downloaded, 100 scene-aware frames extracted and individually read, cross-referenced with the provided transcript. Working frames retained at the session scratchpad `watch-work/frames/`; curated copies committed to `docs/reference-frames/`.*
