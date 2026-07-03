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
  scrape_status: string;
  verification_note: string | null;
  proof_url: string | null;
  created_at: string;
};

export type SubmissionCounts = { pending: number; verified: number; rejected: number };

export const listSubmissions = (f: { status?: string; campaign_id?: string; platform?: string } = {}) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v && p.set(k, String(v)));
  const qs = p.toString();
  return apiFetch<AdminSubmission[]>(`/api/admin/submissions${qs ? `?${qs}` : ""}`, auth());
};

export const getSubmissionCounts = () => apiFetch<SubmissionCounts>("/api/admin/submissions/counts", auth());

export const verifySubmission = (id: string) =>
  apiFetch<AdminSubmission>(`/api/admin/submissions/${id}/verify`, { method: "POST", ...auth() });

export const rejectSubmission = (id: string, note: string) =>
  apiFetch<AdminSubmission>(`/api/admin/submissions/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ note }),
    ...auth(),
  });

/* ---- payouts ---- */
export type OwedRow = {
  creator_id: string;
  display_name: string | null;
  submission_count: number;
  amount_owed: number | string;
};

export type PayoutRow = {
  id: string;
  creator_id: string;
  creator_name: string | null;
  amount: number | string;
  method: string;
  status: string;
  paid_at: string | null;
  created_at: string;
};

export type PayoutMethod = "paypal" | "solana" | "whop";

export const listOwed = () => apiFetch<OwedRow[]>("/api/admin/payouts/owed", auth());
export const listPayouts = () => apiFetch<PayoutRow[]>("/api/admin/payouts", auth());
export const recordPayout = (creator_id: string, method: PayoutMethod) =>
  apiFetch<PayoutRow>("/api/admin/payouts", { method: "POST", body: JSON.stringify({ creator_id, method }), ...auth() });

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

export const listAdminCampaigns = (status?: string) =>
  apiFetch<AdminCampaign[]>(`/api/admin/campaigns${status ? `?status=${status}` : ""}`, auth());

export const createCampaign = (body: CampaignCreate) =>
  apiFetch<AdminCampaign>("/api/admin/campaigns", { method: "POST", body: JSON.stringify(body), ...auth() });

export const publishCampaign = (id: string) =>
  apiFetch<AdminCampaign>(`/api/admin/campaigns/${id}/publish`, { method: "POST", ...auth() });

export const archiveCampaign = (id: string) =>
  apiFetch<AdminCampaign>(`/api/admin/campaigns/${id}/archive`, { method: "POST", ...auth() });

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
