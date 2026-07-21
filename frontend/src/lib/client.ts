import { apiFetch } from "@/lib/api";
import { getClientToken } from "@/lib/auth";

const auth = () => ({ token: getClientToken() ?? undefined });

export type ClientCampaign = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  mode: "create_new" | "copy_paste";
  status: string;
  cpm_rate: number;
  budget: number;
  spent_amount: number;
  payment_type: string | null;
  fixed_amount: number | null;
  platforms: string[];
  brand_name: string | null;
  published_at: string | null;
  total_views: number;
  total_likes: number;
  total_comments: number;
  submission_count: number;
  creator_count: number;
};

export type ClientSubmission = {
  id: string;
  post_url: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  thumbnail_url: string | null;
  post_unavailable: boolean;
  submitted_at: string;
};

export const listClientCampaigns = () =>
  apiFetch<ClientCampaign[]>("/api/client/campaigns", auth());

export const listClientSubmissions = (campaignId: string) =>
  apiFetch<ClientSubmission[]>(`/api/client/campaigns/${campaignId}/submissions`, auth());
