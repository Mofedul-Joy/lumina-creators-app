import { apiFetch } from "@/lib/api";
import { getAdminToken } from "@/lib/auth";

const auth = () => ({ token: getAdminToken() ?? undefined });

export type AdminCampaign = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  mode: "create_new" | "copy_paste";
  status: "draft" | "active" | "paused" | "completed" | "archived";
  cpm_rate: number | string;
  budget: number | string;
  spent_amount: number | string;
  max_payout_per_creator: number | string | null;
  eligible_view_pct: number | string;
  platforms: string[];
  geo_countries: string[];
  brand_name: string | null;
  brand_logo_url: string | null;
  brief_script: string | null;
  content_drive_url: string | null;
  caption_rules: string | null;
  required_mentions: string[];
  requirements_url: string | null;
  min_retention_days: number;
  client_id: string | null;
  published_at: string | null;
};

export type CampaignUpdate = Partial<{
  name: string;
  description: string;
  cpm_rate: number;
  budget: number;
  max_payout_per_creator: number | null;
  eligible_view_pct: number;
  min_retention_days: number;
  platforms: string[];
  brand_name: string;
  brand_logo_url: string;
  brief_script: string;
  content_drive_url: string;
  caption_rules: string;
  requirements_url: string;
}>;

export const getAdminCampaign = (id: string) => apiFetch<AdminCampaign>(`/api/admin/campaigns/${id}`, auth());
export const updateCampaign = (id: string, patch: CampaignUpdate) =>
  apiFetch<AdminCampaign>(`/api/admin/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(patch), ...auth() });

export type CampaignCreate = {
  name: string;
  mode: "create_new" | "copy_paste";
  cpm_rate: number;
  budget: number;
  client_id?: string;
  description?: string;
  platforms?: string[];
  brief_script?: string;
  content_drive_url?: string;
  caption_rules?: string;
  required_mentions?: string[];
  requirements_url?: string;
  brand_name?: string;
  brand_logo_url?: string;
  min_retention_days?: number;
};

export type AdminClient = { id: string; email: string; name: string | null; status: string };

export const listAdminClients = () => apiFetch<AdminClient[]>("/api/admin/clients", auth());

export type AdminStats = {
  total_campaigns: number;
  active_campaigns: number;
  total_creators: number;
  completed_creators: number;
  total_submissions: number;
  total_views: number;
  total_clients: number;
  total_budget: number;
  recent_campaigns: {
    id: string;
    name: string;
    status: string;
    mode: "create_new" | "copy_paste";
    cpm_rate: number;
    budget: number;
  }[];
};

export const getAdminStats = () => apiFetch<AdminStats>("/api/admin/stats", auth());

export type AdminAnalytics = {
  kpis: {
    total_views: number;
    total_spend: number | string;
    total_submissions: number;
    verified_submissions: number;
    active_campaigns: number;
    active_creators: number;
    avg_cpm: number | string;
    engagement_rate: number | string;
  };
  by_platform: { platform: string; views: number; submissions: number }[];
  daily: { date: string; submissions: number; views: number; spend: number | string }[];
  top_campaigns: { id: string; name: string; views: number; submissions: number; spend: number | string }[];
  top_creators: { id: string; display_name: string; views: number; submissions: number }[];
};

export const getAdminAnalytics = () => apiFetch<AdminAnalytics>("/api/admin/analytics", auth());

/* ---- submissions review ---- */
export type AdminSubmission = {
  id: string;
  campaign_id: string;
  campaign_name: string;
  campaign_mode: "create_new" | "copy_paste";
  creator_id: string;
  creator_name: string | null;
  platform: string;
  post_url: string;
  views: number;
  likes: number;
  comments: number;
  estimated_amount: number | string;
  verification_status: "pending" | "verified" | "rejected";
  status: "awaiting_stats" | "proof_uploaded" | "stats_verified" | "paid" | "rejected";
  scrape_status: string;
  verification_note: string | null;
  proof_url: string | null;
  embed_broken: boolean;
  post_unavailable: boolean;
  is_suspicious: boolean;
  creator_is_suspicious: boolean;
  thumbnail_url: string | null;
  claimed: boolean;
  created_at: string;
};

export type SubmissionCounts = { pending: number; verified: number; rejected: number };

export const listSubmissions = (f: { status?: string; campaign_id?: string; platform?: string; suspicious?: boolean } = {}) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
  const qs = p.toString();
  return apiFetch<AdminSubmission[]>(`/api/admin/submissions${qs ? `?${qs}` : ""}`, auth());
};

export const getSubmissionCounts = () => apiFetch<SubmissionCounts>("/api/admin/submissions/counts", auth());

export const verifySubmission = (id: string) =>
  apiFetch<AdminSubmission>(`/api/admin/submissions/${id}/verify`, { method: "POST", ...auth() });

export const flagSubmissionSuspicious = (id: string) =>
  apiFetch<AdminSubmission>(`/api/admin/submissions/${id}/flag-suspicious`, { method: "POST", ...auth() });

export const unflagSubmissionSuspicious = (id: string) =>
  apiFetch<AdminSubmission>(`/api/admin/submissions/${id}/unflag-suspicious`, { method: "POST", ...auth() });

export const rejectSubmission = (id: string, note: string) =>
  apiFetch<AdminSubmission>(`/api/admin/submissions/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ note }),
    ...auth(),
  });

export const logSubmissionPayout = (id: string, method: PayoutMethod, reference?: string) =>
  apiFetch<AdminSubmission>(`/api/admin/submissions/${id}/log-payout`, {
    method: "POST",
    body: JSON.stringify({ method, reference: reference ?? "" }),
    ...auth(),
  });

export const deleteSubmission = (id: string) =>
  apiFetch<void>(`/api/admin/submissions/${id}`, { method: "DELETE", ...auth() });

/* ---- payouts ---- */
export type OwedRow = {
  creator_id: string;
  display_name: string | null;
  submission_count: number;
  amount_owed: number | string;
  payout_method: string | null;
  payout_address: string | null;
};

export type PayoutRow = {
  id: string;
  creator_id: string;
  creator_name: string | null;
  amount: number | string;
  method: string;
  status: string;
  reference: string | null;
  paid_at: string | null;
  created_at: string;
};

export type PayoutMethod = "paypal" | "solana" | "whop";

export const listOwed = () => apiFetch<OwedRow[]>("/api/admin/payouts/owed", auth());
export const listPayouts = () => apiFetch<PayoutRow[]>("/api/admin/payouts", auth());
export const recordPayout = (creator_id: string, method: PayoutMethod, reference?: string) =>
  apiFetch<PayoutRow>("/api/admin/payouts", { method: "POST", body: JSON.stringify({ creator_id, method, reference }), ...auth() });

export const logManualPayment = (body: { creator_id: string; amount: number; method: PayoutMethod; reference?: string }) =>
  apiFetch<PayoutRow>("/api/admin/payouts/manual", { method: "POST", body: JSON.stringify(body), ...auth() });

export const editClient = (id: string, body: { name?: string; password?: string; campaign_ids?: string[] }) =>
  apiFetch<UserRow>(`/api/admin/users/clients/${id}`, { method: "PATCH", body: JSON.stringify(body), ...auth() });

/* ---- settings ---- */
export type PlatformSettings = {
  environment: string;
  email_verification_required: boolean;
  email_provider: string;
  payout_methods: string[];
  campaign_modes: string[];
  storage: string;
};
export const getPlatformSettings = () => apiFetch<PlatformSettings>("/api/admin/settings", auth());

/* ---- users ---- */
export type UserRow = { id: string; email: string; name: string | null; role: string; status: string };
export type UsersOut = { admins: UserRow[]; clients: UserRow[]; creator_count: number; creator_active: number };
export const getUsers = () => apiFetch<UsersOut>("/api/admin/users", auth());
export const suspendClient = (id: string) =>
  apiFetch<UserRow>(`/api/admin/users/clients/${id}/suspend`, { method: "POST", ...auth() });
export const reactivateClient = (id: string) =>
  apiFetch<UserRow>(`/api/admin/users/clients/${id}/reactivate`, { method: "POST", ...auth() });

export type BrandDetail = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  created_at: string;
  campaigns: { id: string; name: string; status: string; cpm_rate: number | string; budget: number | string }[];
};
export type StaffDetail = { id: string; email: string; role: string; status: string; created_at: string };
export const getBrandDetail = (id: string) => apiFetch<BrandDetail>(`/api/admin/users/brands/${id}`, auth());
export const getStaffDetail = (id: string) => apiFetch<StaffDetail>(`/api/admin/users/staff/${id}`, auth());

export type CreateUserIn = { name?: string; email: string; password: string; role: "admin" | "client"; campaign_ids?: string[] };
export const createUser = (body: CreateUserIn) =>
  apiFetch<UserRow>("/api/admin/users/create", { method: "POST", body: JSON.stringify(body), ...auth() });

/* ---- admin image upload (campaign banner/thumbnail) ---- */
export async function adminUploadImage(file: File): Promise<string> {
  const pres = await apiFetch<{ object_id: string; upload_url: string; public_url: string }>(
    "/api/admin/uploads/presign",
    { method: "POST", body: JSON.stringify({ content_type: file.type, filename: file.name, size_bytes: file.size }), ...auth() },
  );
  const put = await fetch(pres.upload_url, { method: "PUT", headers: file.type ? { "Content-Type": file.type } : undefined, body: file });
  if (!put.ok) throw new Error(`Upload failed (HTTP ${put.status})`);
  await apiFetch(`/api/admin/uploads/${pres.object_id}/finalize`, { method: "POST", ...auth() });
  return pres.public_url;
}

export const listAdminCampaigns = (status?: string) =>
  apiFetch<AdminCampaign[]>(`/api/admin/campaigns${status ? `?status=${status}` : ""}`, auth());

export const createCampaign = (body: CampaignCreate) =>
  apiFetch<AdminCampaign>("/api/admin/campaigns", { method: "POST", body: JSON.stringify(body), ...auth() });

export const publishCampaign = (id: string) =>
  apiFetch<AdminCampaign>(`/api/admin/campaigns/${id}/publish`, { method: "POST", ...auth() });

export const archiveCampaign = (id: string) =>
  apiFetch<AdminCampaign>(`/api/admin/campaigns/${id}/archive`, { method: "POST", ...auth() });

export const closeCampaign = (id: string) =>
  apiFetch<AdminCampaign>(`/api/admin/campaigns/${id}/close`, { method: "POST", ...auth() });

export const reopenCampaign = (id: string) =>
  apiFetch<AdminCampaign>(`/api/admin/campaigns/${id}/reopen`, { method: "POST", ...auth() });

export const impersonateClient = (campaignId: string) =>
  apiFetch<{ access_token: string }>(`/api/admin/campaigns/${campaignId}/impersonate-client`, { method: "POST", ...auth() });

/* ---- creator database ---- */
export type CreatorRow = {
  id: string;
  email: string;
  display_name: string | null;
  gender: string | null;
  country: string | null;
  primary_language: string | null;
  total_followers: number;
  platforms: string[];
  completed: boolean;
  is_suspicious: boolean;
};

export type CreatorFilters = {
  q?: string;
  gender?: string;
  country?: string;
  primary_language?: string;
  platform?: string;
  min_followers?: number;
  completed_only?: boolean;
};

export const listCreators = (f: CreatorFilters = {}) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== false) p.set(k, String(v));
  });
  const qs = p.toString();
  return apiFetch<CreatorRow[]>(`/api/admin/creators${qs ? `?${qs}` : ""}`, auth());
};

/* ---- rich creator/applicant detail card (Feature 2) ---- */
export type RichSocialItem = { platform: string; handle: string; profile_url: string | null; follower_count: number };
export type RecentSubmissionItem = {
  id: string;
  post_url: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  shares: number | null;
  thumbnail_url: string | null;
};
export type ExperienceItem = { id: string; title: string; org: string | null; url: string | null; created_at: string };

export type CreatorRichDetail = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  date_of_birth: string | null;
  age: number | null;
  gender: string | null;
  ethnicity: string | null;
  education: string | null;
  primary_language: string | null;
  languages: string[];
  country: string | null;
  city: string | null;
  completed: boolean;
  is_suspicious: boolean;
  rank: string;
  xp: number;
  streak_days: number;
  awards: string[];
  niches: string[];
  total_views: number;
  total_earned: number | string;
  total_posts: number;
  socials: RichSocialItem[];
  recent_submissions: RecentSubmissionItem[];
  experiences: ExperienceItem[];
};

export const getCreatorRichDetail = (id: string) =>
  apiFetch<CreatorRichDetail>(`/api/admin/creators/${id}/rich`, auth());

/* ---- applicants pipeline (Feature 1 — SideShift-style admin triage) ---- */
export type ApplicantVideo = {
  id: string;
  thumbnail_url: string | null;
  post_url: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  caption?: string | null;
};

export type ApplicantSocial = {
  platform: string;
  handle: string;
  profile_url: string | null;
  follower_count: number;
};

export type ApplicantListItem = {
  id: string;
  campaign_id: string;
  campaign_name: string;
  creator_id: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  gender: string | null;
  city: string | null;
  age: number | null;
  status: string;
  platforms: string[];
  recent_videos: ApplicantVideo[];
  views: number;
  earnings: number | string;
  applied_at: string;
  admin_note: string | null;
};

export type ApplicantDetail = {
  id: string;
  campaign_id: string;
  campaign_name: string;
  creator_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  gender: string | null;
  age: number | null;
  primary_language: string | null;
  education: string | null;
  status: string;
  views: number;
  earnings: number | string;
  posts: number;
  streak_days: number;
  socials: ApplicantSocial[];
  recent_videos: ApplicantVideo[];
  niches: string[];
  admin_note: string | null;
  applied_at: string;
  reviewed_at: string | null;
  messaged_at: string | null;
  bookmarked_at: string | null;
  declined_at: string | null;
  accepted_at: string | null;
};

export type ApplicantFilters = {
  campaign_id?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export type ApplicantCounts = {
  new: number;
  reviewed: number;
  messaged: number;
  declined: number;
  bookmarked: number;
  accepted: number;
  submitted: number;
  approved: number;
  rejected: number;
};

export type ApplicantUpdateIn = Partial<{ status: string; admin_note: string }>;

export const listApplicants = (f: ApplicantFilters = {}) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v !== undefined && v !== "") p.set(k, String(v));
  });
  const qs = p.toString();
  return apiFetch<ApplicantListItem[]>(`/api/admin/applicants${qs ? `?${qs}` : ""}`, auth());
};

export const getApplicantCounts = (campaign_id?: string) =>
  apiFetch<ApplicantCounts>(`/api/admin/applicants/counts${campaign_id ? `?campaign_id=${campaign_id}` : ""}`, auth());

export const getApplicantDetail = (id: string) =>
  apiFetch<ApplicantDetail>(`/api/admin/applicants/${id}`, auth());

export const updateApplicant = (id: string, patch: ApplicantUpdateIn) =>
  apiFetch<ApplicantDetail>(`/api/admin/applicants/${id}`, { method: "PATCH", body: JSON.stringify(patch), ...auth() });

export function applicantsExportCsvUrl(f: { campaign_id?: string; status?: string } = {}): string {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, String(v)); });
  const qs = p.toString();
  return `${API_URL}/api/admin/applicants/export.csv${qs ? `?${qs}` : ""}`;
}
