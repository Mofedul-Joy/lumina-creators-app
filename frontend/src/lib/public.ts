// Public, unauthenticated client report client (Feature 6). No auth headers —
// gated purely by a high-entropy share_token in the URL path. Keep in
// lockstep with backend/app/schemas/public_report.py's PublicReportOut.
import { apiFetch } from "@/lib/api";

export type PublicReportSubmission = {
  id: string;
  creator_display_name: string | null;
  creator_avatar_url: string | null;
  platform: string;
  post_url: string;
  thumbnail_url: string | null;
  views: number;
  likes: number;
  comments: number;
  submitted_at: string;
};

export type PublicReport = {
  campaign_id: string;
  slug: string;
  name: string;
  brand_name: string | null;
  banner_url: string | null;
  status: string;
  mode: string;
  published_at: string | null;
  total_views: number;
  total_likes: number;
  total_comments: number;
  engagement_rate: number;
  submission_count: number;
  creator_count: number;
  submissions: PublicReportSubmission[];
};

export const getPublicReport = (token: string) =>
  apiFetch<PublicReport>(`/api/public/report/${token}`);
