import { apiFetch } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";

const auth = () => ({ token: getAuthToken() ?? undefined });

export type AdminCampaign = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  mode: "create_new" | "copy_paste";
  status: "draft" | "active" | "paused" | "completed" | "archived";
  cpm_rate: number;
  budget: number;
  spent_amount: number;
  platforms: string[];
  brand_name: string | null;
  brief_script: string | null;
  content_drive_url: string | null;
  min_retention_days: number;
  published_at: string | null;
};

export type CampaignCreate = {
  name: string;
  mode: "create_new" | "copy_paste";
  cpm_rate: number;
  budget: number;
  description?: string;
  platforms?: string[];
  brief_script?: string;
  content_drive_url?: string;
  caption_rules?: string;
  required_mentions?: string[];
  brand_name?: string;
  min_retention_days?: number;
};

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
