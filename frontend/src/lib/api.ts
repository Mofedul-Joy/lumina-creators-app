// Typed API client — the contract with the FastAPI backend. Keep in lockstep with Pydantic schemas.
import { clearSession, getAccess, getRefresh, realmFromPath, saveSession, type Realm } from "@/lib/tokens";

// Backend URL resolution order:
//   1) Runtime: if we're served from *.vercel.app (production frontend), pin to the
//      canonical Render backend regardless of stale/wrong build-time env vars.
//      This survives Vercel env-var drift without redeploys.
//   2) Build-time NEXT_PUBLIC_API_URL (dev, previews, or manual overrides).
//   3) Local dev fallback.
const PROD_BACKEND_URL = "https://lumina-creators-api-app.onrender.com";
function resolveApiUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.endsWith(".vercel.app") || host === "lumina-creators-app.vercel.app") {
      return PROD_BACKEND_URL;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}
const API_URL = resolveApiUrl();

// Downloads a CSV export that requires the bearer token — plain <a href> can't
// attach an Authorization header, so this fetches the blob and triggers a
// save via a throwaway object URL.
export async function downloadCsv(path: string, token: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new ApiError(`Export failed (HTTP ${res.status})`, res.status);
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : "export.csv";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** True when an error means "not authenticated / not authorized" (401/403),
 * as opposed to a network outage or 5xx. Used to decide whether to log out. */
export function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

// React Query retry policy: never retry an auth failure (let the page redirect
// to login fast), but DO retry transient network blips / 5xx a couple of times
// so a single "Failed to fetch" (e.g. a Render cold-start) doesn't leave the
// page stuck on an error the user has to manually reload past.
export function retryNonAuth(failureCount: number, error: unknown): boolean {
  if (isAuthError(error)) return false;
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

// One in-flight refresh per realm — concurrent 401s share it so the rotating
// refresh token isn't spent twice (which would trip reuse-detection and log out).
const refreshing: Partial<Record<Realm, Promise<string | null>>> = {};

// `usedToken` is the access token the failing request sent. With multiple tabs
// open, another tab may have already rotated the refresh token — so before (and
// after) we spend ours, we check whether localStorage now holds a NEWER access
// token than the one that just 401'd, and use that instead of tripping
// reuse-detection and logging everyone out.
async function refreshRealm(realm: Realm, usedToken?: string): Promise<string | null> {
  const newer = getAccess(realm);
  if (newer && newer !== usedToken) return newer; // another tab already refreshed
  if (refreshing[realm]) return refreshing[realm]!;
  const refresh = getRefresh(realm);
  if (!refresh) return null;
  const p = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/${realm}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) {
        // We may have just lost a cross-tab rotation race: another tab could have
        // saved a fresh token a moment ago. Only clear the session if there's
        // genuinely no newer token to fall back on.
        const afterFail = getAccess(realm);
        if (afterFail && afterFail !== usedToken) return afterFail;
        clearSession(realm); // refresh token expired/invalid → force re-login
        return null;
      }
      const data = await res.json();
      saveSession(realm, data.access_token, data.refresh_token);
      return data.access_token as string;
    } catch {
      return null; // network blip — don't wipe the session
    } finally {
      delete refreshing[realm];
    }
  })();
  refreshing[realm] = p;
  return p;
}

export async function apiFetch<T>(
  path: string,
  opts: { method?: string; token?: string; body?: string; _retried?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body,
  });
  // Access token expired → silently refresh once and retry, so idle time never
  // bounces the user to the login page.
  if (res.status === 401 && !opts._retried) {
    const realm = realmFromPath(path);
    if (realm) {
      const fresh = await refreshRealm(realm, opts.token);
      if (fresh) return apiFetch<T>(path, { ...opts, token: fresh, _retried: true });
    }
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = payload?.detail;
    // FastAPI validation errors send detail as an array of {loc, msg} objects.
    const message = Array.isArray(detail)
      ? detail.map((d: { loc?: (string | number)[]; msg?: string }) =>
          `${(d.loc ?? []).slice(1).join(".")}: ${d.msg ?? "invalid"}`).join("; ")
      : typeof detail === "string"
        ? detail
        : `HTTP ${res.status}`;
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type Health = {
  status: string;
  service: string;
  version: string;
  environment: string;
};

// ── Public campaign entry (no auth) — the campaign-first funnel: browse,
// pick one, submit an email + post URL. Auth (check-email/login/set-password)
// happens one step later via the existing creator auth endpoints. ───────────
// Bonus milestone + wizard fields (Feature 3, BUILD_SPEC.md §3.3) mirrored
// from lib/campaigns.ts's CampaignWizardFields — duplicated (not imported) to
// avoid a circular import between api.ts <-> campaigns.ts. Keep the two in
// lockstep with backend/app/schemas/campaign.py's CampaignPublicOut.
export type PublicBonusMilestone = {
  id: string;
  views_threshold: number;
  bonus_amount: number;
  description: string | null;
  sort_order: number;
};

export type PublicCampaign = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  mode: "create_new" | "copy_paste";
  cpm_rate: number;
  budget: number;
  platforms: string[];
  min_retention_days: number;
  brief_script: string | null;
  content_drive_url: string | null;
  caption_rules: string | null;
  required_mentions: string[];
  example_captions: string[];
  requirements_url: string | null;
  brand_name: string | null;
  brand_logo_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  joined: boolean;
  // ── 6-step campaign builder wizard (Feature 3) — surfaced natively (Feature 5) ──
  payment_type: string | null;
  fixed_amount: number | null;
  weekly_hours_needed: number | null;
  hourly_rate: number | null;
  required_hours: number | null;
  per_post_amount: number | null;
  example_videos: string[];
  examples?: { url: string; platform?: string | null; thumbnail_url?: string | null }[];
  age_requirement: string | null;
  platform_focus: string[];
  content_type: string | null;
  posting_frequency: string | null;
  video_length: string | null;
  account_type: string | null;
  is_app: boolean;
  physical_product: boolean;
  banner_url: string | null;
  bonus_milestones: PublicBonusMilestone[];
  job_type: string | null;
  creator_type: string | null;
};

export const publicApi = {
  campaigns: (status: "active" | "completed" = "active") =>
    apiFetch<PublicCampaign[]>(`/api/public/campaigns?status=${status}`),
  campaign: (slug: string) => apiFetch<PublicCampaign>(`/api/public/campaigns/${slug}`),
  submit: (slug: string, body: { email: string; post_url: string }) =>
    apiFetch<{ status: string }>(`/api/public/campaigns/${slug}/submit`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// ── Enums (mirror backend Postgres enums) ─────────────────────────────────────
export const GENDERS = [
  "male",
  "female",
  "non_binary",
  "other",
  "prefer_not_to_say",
] as const;
export type Gender = (typeof GENDERS)[number];

export const CREATOR_TYPES = ["ugc", "influencer", "both"] as const;
export type CreatorType = (typeof CREATOR_TYPES)[number];

export const EDUCATION_LEVELS = ["in_high_school", "in_college", "graduated", "grad_school", "no_college", "na"] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "twitter",
  "facebook",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const UPLOAD_PURPOSES = [
  "avatar",
  "portfolio_video",
  "proof_video",
] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

// ── Creator profile schemas ───────────────────────────────────────────────────
export const PAYOUT_METHODS = ["paypal", "solana", "whop"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export type ProfileIn = {
  display_name?: string;
  creator_type?: CreatorType;
  bio?: string;
  date_of_birth?: string; // YYYY-MM-DD
  gender?: Gender;
  ethnicity?: string;
  education?: EducationLevel;
  primary_language?: string;
  languages?: string[];
  country?: string;
  city?: string;
  avatar_object_id?: string;
  payout_method?: PayoutMethod;
  payout_address?: string;
  payout_paypal?: string;
  payout_solana?: string;
  payout_whop?: string;
};

export type ProfileOut = {
  display_name: string | null;
  creator_type: CreatorType | null;
  bio: string | null;
  date_of_birth: string | null;
  gender: Gender | null;
  ethnicity: string | null;
  education: EducationLevel | null;
  primary_language: string | null;
  languages: string[];
  country: string | null;
  city: string | null;
  avatar_object_id: string | null;
  avatar_url: string | null;
  payout_method: PayoutMethod | null;
  payout_address: string | null;
  payout_paypal: string | null;
  payout_solana: string | null;
  payout_whop: string | null;
  completed: boolean;
  missing: string[];
};

export type ProfileSection = "about" | "socials" | "videos" | "details" | "payment";
export type CompletionOut = {
  completed: boolean;
  missing: string[];
  sections: Partial<Record<ProfileSection, boolean>>;
  next_section: ProfileSection | null;
};

export type SocialIn = {
  platform: Platform;
  handle: string;
  profile_url?: string;
  follower_count?: number;
};

export type SocialOut = {
  id: string;
  platform: Platform;
  handle: string;
  profile_url: string | null;
  follower_count: number;
  is_verified: boolean;
};

export type PortfolioIn = {
  storage_object_id?: string;
  video_url?: string;
  brand_name?: string;
  caption?: string;
  platform?: Platform;
};

export type PortfolioOut = {
  id: string;
  video_url: string | null;
  thumbnail_url: string | null;
  is_upload: boolean;
  brand_name: string | null;
  caption: string | null;
  platform: Platform | null;
};

// ── Uploads schemas ───────────────────────────────────────────────────────────
export type PresignIn = {
  purpose: UploadPurpose;
  content_type?: string;
  filename?: string;
  size_bytes?: number;
};

export type PresignOut = {
  object_id: string;
  object_key: string;
  upload_url: string;
};

export type StorageObjectOut = {
  id: string;
  purpose: UploadPurpose;
  status: string;
  content_type: string | null;
};

// ── Admin creators schemas ────────────────────────────────────────────────────
export type CreatorListItem = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  gender: Gender | null;
  country: string | null;
  primary_language: string | null;
  total_followers: number;
  platforms: Platform[];
  completed: boolean;
  is_suspicious: boolean;
  rank: string | null;
  total_views: number;
  total_earned: number | string;
  // SideShift-parity roster columns.
  status: string;
  accounts_count: number;
  campaigns_total: number;
  campaigns_active: number;
  posts_7d: number;
  days_active_7d: number;
  created_at: string | null;
};

export type SocialItem = {
  platform: Platform;
  handle: string;
  profile_url: string | null;
  follower_count: number;
};

export type PortfolioItemOut = {
  id: string;
  brand_name: string | null;
  caption: string | null;
  platform: Platform | null;
  video_url: string | null;
  thumbnail_url: string | null;
  is_top_content: boolean;
  views: number;
  likes: number;
};

export type CreatorDetail = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  date_of_birth: string | null;
  gender: Gender | null;
  ethnicity: string | null;
  primary_language: string | null;
  languages: string[];
  country: string | null;
  city: string | null;
  completed: boolean;
  is_suspicious: boolean;
  socials: SocialItem[];
  portfolio: PortfolioItemOut[];
  payout_method: string | null;
  payout_address: string | null;
  payout_paypal: string | null;
  payout_solana: string | null;
  payout_whop: string | null;
};

export type CreatorFilters = {
  q?: string;
  gender?: Gender;
  ethnicity?: string;
  primary_language?: string;
  country?: string;
  city?: string;
  age_min?: number;
  age_max?: number;
  platform?: Platform;
  min_followers?: number;
  social?: string;
  completed_only?: boolean;
  limit?: number;
  offset?: number;
};

// ── Feature 2: rich creator/applicant detail card ─────────────────────────────
export type GemstoneRank = "bronze" | "sapphire" | "gold" | "emerald" | "amber" | "ruby";

export type RichSocialItem = {
  platform: Platform;
  handle: string;
  profile_url: string | null;
  follower_count: number;
};

export type RecentSubmissionItem = {
  id: string;
  post_url: string;
  platform: Platform;
  views: number;
  likes: number;
  comments: number;
  shares: number | null;
  thumbnail_url: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
};

export type ExperienceItem = {
  id: string;
  title: string;
  org: string | null;
  url: string | null;
  created_at: string;
};

export type CreatorRichDetail = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  date_of_birth: string | null;
  age: number | null;
  gender: Gender | null;
  ethnicity: string | null;
  education: string | null;
  primary_language: string | null;
  languages: string[];
  country: string | null;
  city: string | null;
  completed: boolean;
  is_suspicious: boolean;
  rank: GemstoneRank | string;
  xp: number;
  streak_days: number;
  awards: string[];
  niches: string[];
  creator_type: string | null;
  total_views: number;
  total_earned: number | string;
  total_posts: number;
  total_likes: number;
  engagement_rate: number;
  socials: RichSocialItem[];
  recent_submissions: RecentSubmissionItem[];
  experiences: ExperienceItem[];
  portfolio: PortfolioItemOut[];
};

// The creator's own portfolio page data (same shape the admin sees).
export const getMyPortfolio = (token: string) =>
  apiFetch<CreatorRichDetail>("/api/creator/me/portfolio", { token });

export type MyCampaign = {
  participation_id: string;
  campaign_id: string;
  slug: string;
  name: string;
  brand_name: string | null;
  mode: string;
  cpm_rate: number | string;
  status: string;
  submission_count: number;
};

// Campaigns the creator applied to / joined, with application status.
export const listMyCampaigns = (token: string) =>
  apiFetch<MyCampaign[]>("/api/creator/campaigns/mine", { token });

// ── Creator profile methods (creator bearer token) ────────────────────────────
export const getProfile = (token: string) =>
  apiFetch<ProfileOut>("/api/creator/profile", { token });

export const updateProfile = (token: string, body: ProfileIn) =>
  apiFetch<ProfileOut>("/api/creator/profile", {
    method: "PUT",
    body: JSON.stringify(body),
    token,
  });

export const getCompletion = (token: string) =>
  apiFetch<CompletionOut>("/api/creator/profile/completion", { token });

export const listSocials = (token: string) =>
  apiFetch<SocialOut[]>("/api/creator/profile/socials", { token });

export const addSocial = (token: string, body: SocialIn) =>
  apiFetch<SocialOut>("/api/creator/profile/socials", {
    method: "POST",
    body: JSON.stringify(body),
    token,
  });

export const deleteSocial = (token: string, id: string) =>
  apiFetch<void>(`/api/creator/profile/socials/${id}`, {
    method: "DELETE",
    token,
  });

// ── Handle verification (bio-code method) ─────────────────────────────────────
export type SocialVerifyStartOut = {
  platform: Platform;
  handle: string;
  code: string | null;          // null when already verified
  expires_at: string | null;
  instructions: string;
  already_verified: boolean;
};

export const startSocialVerify = (token: string, platform: Platform, handle: string) =>
  apiFetch<SocialVerifyStartOut>("/api/creator/profile/socials/verify/start", {
    method: "POST",
    body: JSON.stringify({ platform, handle }),
    token,
  });

export const confirmSocialVerify = (token: string, platform: Platform, handle: string) =>
  apiFetch<SocialOut>("/api/creator/profile/socials/verify/confirm", {
    method: "POST",
    body: JSON.stringify({ platform, handle }),
    token,
  });

export const listPortfolio = (token: string) =>
  apiFetch<PortfolioOut[]>("/api/creator/profile/portfolio", { token });

export const addPortfolio = (token: string, body: PortfolioIn) =>
  apiFetch<PortfolioOut>("/api/creator/profile/portfolio", {
    method: "POST",
    body: JSON.stringify(body),
    token,
  });

export const deletePortfolio = (token: string, id: string) =>
  apiFetch<void>(`/api/creator/profile/portfolio/${id}`, {
    method: "DELETE",
    token,
  });

// ── Invites (public: holding the token IS the credential) ─────────────────────
export type InvitePeek = {
  email: string | null;   // null = a generic shareable link
  accepted: boolean;
};

export const peekInvite = (token: string) =>
  apiFetch<InvitePeek>(`/api/invites/${encodeURIComponent(token)}`);

// ── Top videos (Portfolio "Top Content") ──────────────────────────────────────
export type TopVideoPlatform = "tiktok" | "instagram";

export type TopVideoOut = {
  id: string;
  platform: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  views: number;
  likes: number;
};

export const listTopVideos = (token: string) =>
  apiFetch<TopVideoOut[]>("/api/creator/profile/top-videos", { token });

export const addTopVideo = (token: string, platform: TopVideoPlatform, video_url: string) =>
  apiFetch<TopVideoOut>("/api/creator/profile/top-videos", {
    method: "POST",
    body: JSON.stringify({ platform, video_url }),
    token,
  });

export const refreshTopVideo = (token: string, id: string) =>
  apiFetch<TopVideoOut>(`/api/creator/profile/top-videos/${id}/refresh`, { method: "POST", token });

export const deleteTopVideo = (token: string, id: string) =>
  apiFetch<void>(`/api/creator/profile/top-videos/${id}`, { method: "DELETE", token });

// ── Notifications (top-bar bell) ──────────────────────────────────────────────
export type NotificationOut = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export const listNotifications = (token: string) =>
  apiFetch<NotificationOut[]>("/api/creator/notifications", { token });

export const getUnreadCount = (token: string) =>
  apiFetch<{ unread: number }>("/api/creator/notifications/unread-count", { token });

/** Mark specific notifications read, or ALL unread when `ids` is omitted. */
export const markNotificationsRead = (token: string, ids?: string[]) =>
  apiFetch<{ unread: number }>("/api/creator/notifications/read", {
    method: "POST",
    body: JSON.stringify({ ids: ids ?? null }),
    token,
  });

// ── Contracts (Campaign Participation Agreement) ──────────────────────────────
export type ContractStatus = "sent" | "viewed" | "accepted" | "declined";

export type ContractSummary = {
  document_id: string;
  campaign_name: string;
  company_name: string;
  status: ContractStatus;
  created_at: string;
  accepted_at: string | null;
};

export type ContractDetail = {
  document_id: string;
  title: string;
  subtitle: string;
  company_name: string;
  campaign_name: string;
  body: string;
  status: ContractStatus;
  accepted_at: string | null;
  accepted_name: string | null;
};

export const listMyContracts = (token: string) =>
  apiFetch<ContractSummary[]>("/api/creator/contracts", { token });

export const getContract = (token: string, documentId: string) =>
  apiFetch<ContractDetail>(`/api/creator/contracts/${documentId}`, { token });

export const acceptContract = (token: string, documentId: string, name: string) =>
  apiFetch<ContractDetail>(`/api/creator/contracts/${documentId}/accept`, {
    method: "POST",
    body: JSON.stringify({ name }),
    token,
  });

// ── Experiences ───────────────────────────────────────────────────────────────
export type ExperienceKind = "organic_ugc" | "ugc_paid_ad" | "professional_role";

export type ExperienceIn = {
  kind: ExperienceKind;
  role_title?: string;    // required when kind === "professional_role"
  company_name: string;   // brand/client — the one required field
  company_url?: string;
  description?: string;
  platforms?: string[];
  deliverable?: string;
  niche?: string;
  work_url?: string;
  results?: string;
  period?: string;
};

export type ExperienceOut = {
  id: string;
  kind: ExperienceKind;
  kind_label: string;
  title: string;
  org: string | null;
  url: string | null;
  description: string | null;
  platforms: string[];
  deliverable: string | null;
  niche: string | null;
  work_url: string | null;
  results: string | null;
  period: string | null;
  verified: boolean;
  created_at: string;
};

// Static option lists that power the Add Experience form (kept UI-side; the
// backend accepts any value, so these can evolve without a deploy dependency).
export const EXPERIENCE_PLATFORMS: { key: string; label: string }[] = [
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
  { key: "twitter", label: "X" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "other", label: "Other" },
];
export const EXPERIENCE_DELIVERABLES = [
  "Short-form video",
  "Long-form video",
  "Photo / image",
  "Story",
  "Livestream",
  "Blog / article",
  "Product review",
  "Other",
];
export const EXPERIENCE_NICHES = [
  "Beauty", "Fashion", "Fitness", "Food & drink", "Travel", "Tech", "Gaming",
  "Finance", "Health & wellness", "Home & lifestyle", "Parenting", "Pets",
  "Education", "Business", "Entertainment", "Other",
];

export const listExperiences = (token: string) =>
  apiFetch<ExperienceOut[]>("/api/creator/profile/experiences", { token });

export const listRoleTitles = (token: string) =>
  apiFetch<string[]>("/api/creator/profile/experiences/role-titles", { token });

export const addExperience = (token: string, body: ExperienceIn) =>
  apiFetch<ExperienceOut>("/api/creator/profile/experiences", {
    method: "POST",
    body: JSON.stringify(body),
    token,
  });

export const deleteExperience = (token: string, id: string) =>
  apiFetch<void>(`/api/creator/profile/experiences/${id}`, {
    method: "DELETE",
    token,
  });

// ── Uploads methods (creator bearer token) ────────────────────────────────────
export const presignUpload = (token: string, body: PresignIn) =>
  apiFetch<PresignOut>("/api/creator/uploads/presign", {
    method: "POST",
    body: JSON.stringify(body),
    token,
  });

export const finalizeUpload = (token: string, objectId: string) =>
  apiFetch<StorageObjectOut>(`/api/creator/uploads/${objectId}/finalize`, {
    method: "POST",
    token,
  });

// Uploads the raw file bytes to the presigned URL (S3/R2 PUT). Uses XHR (not
// fetch) so callers can render a progress bar via onProgress (0-100). Not a
// JSON call, so it bypasses apiFetch.
export function putToPresignedUrl(
  uploadUrl: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (HTTP ${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

// Runs the full presign → PUT → finalize lifecycle and returns the finalized object id.
export async function uploadFile(
  token: string,
  file: File,
  purpose: UploadPurpose,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const presigned = await presignUpload(token, {
    purpose,
    content_type: file.type || undefined,
    filename: file.name || undefined,
    size_bytes: file.size,
  });
  await putToPresignedUrl(presigned.upload_url, file, onProgress);
  const finalized = await finalizeUpload(token, presigned.object_id);
  return finalized.id;
}

// Upload a portfolio video FILE (presign -> PUT -> finalize -> attach). Distinct
// from a submission: it just showcases the creator's work, stored on R2.
export async function uploadPortfolioVideo(
  token: string,
  file: File,
  meta: { brand_name?: string; caption?: string },
  onProgress?: (pct: number) => void,
): Promise<PortfolioOut> {
  const objectId = await uploadFile(token, file, "portfolio_video", onProgress);
  return addPortfolio(token, {
    storage_object_id: objectId,
    brand_name: meta.brand_name || undefined,
    caption: meta.caption || undefined,
  });
}

// ── Admin creators methods (admin bearer token) ───────────────────────────────
export const listCreators = (token: string, filters: CreatorFilters = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return apiFetch<CreatorListItem[]>(
    `/api/admin/creators${qs ? `?${qs}` : ""}`,
    { token },
  );
};

export const getCreatorDetail = (token: string, id: string) =>
  apiFetch<CreatorDetail>(`/api/admin/creators/${id}`, { token });

export const flagCreatorSuspicious = (token: string, id: string) =>
  apiFetch<CreatorDetail>(`/api/admin/creators/${id}/flag-suspicious`, { method: "POST", token });

export const unflagCreatorSuspicious = (token: string, id: string) =>
  apiFetch<CreatorDetail>(`/api/admin/creators/${id}/unflag-suspicious`, { method: "POST", token });

export const getCreatorRichDetail = (token: string, id: string) =>
  apiFetch<CreatorRichDetail>(`/api/admin/creators/${id}/rich`, { token });
