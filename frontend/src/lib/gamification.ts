// Creator-facing gamification types + fetch (Feature 7, BUILD_SPEC.md 3.9).
// Mirrors backend/app/schemas/gamification.py's CreatorGamificationOut.
import { apiFetch } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";

export type GemstoneRank = "bronze" | "sapphire" | "gold" | "emerald" | "amber" | "ruby";

export const KNOWN_AWARDS = [
  "persistent_pro",
  "gig_completion_mastery",
  "earnings_mastery",
  "interview_mastery",
] as const;
export type AwardKey = (typeof KNOWN_AWARDS)[number];

export type CreatorGamification = {
  rank: GemstoneRank | string;
  rank_label: string;
  xp: number;
  xp_to_next: number;
  next_rank: GemstoneRank | string | null;
  streak_days: number;
  awards: string[];
  total_views: number;
  total_earned: number | string;
  total_posts: number;
};

export const getMyGamification = () =>
  apiFetch<CreatorGamification>("/api/creator/me/gamification", { token: getAuthToken() ?? undefined });
