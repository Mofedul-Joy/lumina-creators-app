import { apiFetch, finalizeUpload, presignUpload, putToPresignedUrl } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";

const auth = () => ({ token: getAuthToken() ?? undefined });

export type Campaign = {
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
};

export type Participation = { id: string; campaign_id: string; status: string };
export type Submission = {
  id: string;
  campaign_id: string;
  post_url: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  estimated_amount: number;
  payable_amount: number | null;
  scrape_status: string;
  verification_status: string;
  verification_note: string | null;
  has_proof_video: boolean;
  thumbnail_url: string | null;
  created_at: string;
};

export const browseCampaigns = () => apiFetch<Campaign[]>("/api/creator/campaigns", auth());

export const listSubmissions = () =>
  apiFetch<Submission[]>("/api/creator/submissions", auth());

export const getCampaign = (slug: string) =>
  apiFetch<Campaign>(`/api/creator/campaigns/${slug}`, auth());

export const joinCampaign = (slug: string) =>
  apiFetch<Participation>(`/api/creator/campaigns/${slug}/join`, { method: "POST", ...auth() });

export const submitClip = (campaign_slug: string, post_url: string) =>
  apiFetch<Submission>("/api/creator/submissions", {
    method: "POST",
    body: JSON.stringify({ campaign_slug, post_url }),
    ...auth(),
  });

// Uploads a proof-of-post video (presign -> PUT -> finalize) and links it to the
// submission — the create_new verification gate an admin reviews before payout.
export async function uploadProofVideo(submissionId: string, file: File): Promise<Submission> {
  const token = getAuthToken() ?? undefined;
  const presigned = await presignUpload(token!, {
    purpose: "proof_video",
    content_type: file.type || undefined,
    filename: file.name || undefined,
    size_bytes: file.size,
  });
  await putToPresignedUrl(presigned.upload_url, file);
  await finalizeUpload(token!, presigned.object_id);
  return apiFetch<Submission>(`/api/creator/submissions/${submissionId}/proof`, {
    method: "PATCH",
    body: JSON.stringify({ storage_object_id: presigned.object_id }),
    ...auth(),
  });
}
