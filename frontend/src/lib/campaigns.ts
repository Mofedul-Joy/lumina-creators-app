import { apiFetch, finalizeUpload, presignUpload, putToPresignedUrl, uploadCapturedPoster } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";

const auth = () => ({ token: getAuthToken() ?? undefined });

// Bonus milestone row (Feature 3 wizard step 3) — surfaced natively on the
// campaign brief page (Feature 5) instead of living only in the admin builder.
export type BonusMilestone = {
  id: string;
  views_threshold: number;
  bonus_amount: number;
  description: string | null;
  sort_order: number;
};

// Wizard fields (Feature 3, BUILD_SPEC.md §3.3) shared by the creator-facing
// campaign types (CampaignPublicOut on the backend) — every field optional /
// defaulted so legacy campaigns created before the wizard still render fine.
export type CampaignWizardFields = {
  payment_type: string | null;
  fixed_amount: number | null;
  fixed_unit: string | null;
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
  bonus_milestones: BonusMilestone[];
  job_type: string | null;
  creator_type: string | null;
};

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
  approved: boolean;
} & CampaignWizardFields;

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
  revision_mode: "edit" | "repost" | null;
  has_proof_video: boolean;
  thumbnail_url: string | null;
  claimed: boolean;
  is_paid: boolean;
  created_at: string;
};

export const browseCampaigns = () => apiFetch<Campaign[]>("/api/creator/campaigns", auth());

// Campaigns an admin personally invited this creator to — same shape as browse,
// so they render with the identical Explore CampaignCard (thumbnail + Joined badge).
export const listInvitedCampaigns = () => apiFetch<Campaign[]>("/api/creator/campaigns/invited", auth());

export const listSubmissions = () =>
  apiFetch<Submission[]>("/api/creator/submissions", auth());

export const getSubmission = (id: string) =>
  apiFetch<Submission>(`/api/creator/submissions/${id}`, auth());

export const claimSubmission = (id: string) =>
  apiFetch<Submission>(`/api/creator/submissions/${id}/claim`, { method: "POST", ...auth() });

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

// Amend a revision-requested (mode 'edit') submission with a corrected link →
// back to pending review. campaign_slug is ignored server-side but keeps the
// SubmissionCreateIn shape.
export const resubmitClip = (id: string, post_url: string) =>
  apiFetch<Submission>(`/api/creator/submissions/${id}/resubmit`, {
    method: "POST",
    body: JSON.stringify({ campaign_slug: "", post_url }),
    ...auth(),
  });

// Uploads a proof-of-post video (presign -> PUT -> finalize) and links it to the
// submission — the create_new verification gate an admin reviews before payout.
export async function uploadProofVideo(
  submissionId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<Submission> {
  const token = getAuthToken() ?? undefined;
  const presigned = await presignUpload(token!, {
    purpose: "proof_video",
    content_type: file.type || undefined,
    filename: file.name || undefined,
    size_bytes: file.size,
  });
  // Capture the first frame in parallel with the video upload for an instant
  // thumbnail; best-effort, so a failure never blocks the proof submission.
  const [, thumbnail_url] = await Promise.all([
    putToPresignedUrl(presigned.upload_url, file, onProgress),
    uploadCapturedPoster(token!, file),
  ]);
  await finalizeUpload(token!, presigned.object_id);
  return apiFetch<Submission>(`/api/creator/submissions/${submissionId}/proof`, {
    method: "PATCH",
    body: JSON.stringify({ storage_object_id: presigned.object_id, thumbnail_url }),
    ...auth(),
  });
}
