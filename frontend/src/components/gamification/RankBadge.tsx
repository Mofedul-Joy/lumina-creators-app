// Gemstone rank badge (Feature 7, BUILD_SPEC.md 3.9). Dark surface + colored
// ring/text accent — matches the brand's dark green/black surfaces rather
// than full rainbow blocks. Shared by the creator dashboard, account page,
// and the admin CreatorDetailCard.
export type GemstoneRank = "bronze" | "sapphire" | "gold" | "emerald" | "amber" | "ruby";

export const RANK_STYLES: Record<string, { label: string; bg: string; fg: string; ring: string }> = {
  bronze: { label: "Bronze", bg: "rgba(205,127,50,0.14)", fg: "#cd7f32", ring: "rgba(205,127,50,0.45)" },
  sapphire: { label: "Sapphire", bg: "rgba(15,82,186,0.16)", fg: "#5b9dfa", ring: "rgba(15,82,186,0.45)" },
  gold: { label: "Gold", bg: "rgba(255,215,0,0.14)", fg: "#facc15", ring: "rgba(255,215,0,0.45)" },
  emerald: { label: "Emerald", bg: "rgba(80,200,120,0.16)", fg: "#4ade80", ring: "rgba(80,200,120,0.5)" },
  amber: { label: "Amber", bg: "rgba(255,191,0,0.14)", fg: "#fbbf24", ring: "rgba(255,191,0,0.45)" },
  ruby: { label: "Ruby", bg: "rgba(224,17,95,0.16)", fg: "#fb7185", ring: "rgba(224,17,95,0.45)" },
};

export const RANK_ORDER: GemstoneRank[] = ["bronze", "sapphire", "gold", "emerald", "amber", "ruby"];

// Mirrors backend/app/services/gamification.py's RANK_THRESHOLDS. Used where
// only `rank`/`xp` are known (e.g. the admin rich-detail card) and the
// server hasn't computed xp_to_next/next_rank for us.
export const RANK_THRESHOLDS: Record<GemstoneRank, number> = {
  bronze: 0,
  sapphire: 100,
  gold: 500,
  emerald: 1500,
  amber: 4000,
  ruby: 8000,
};

export function nextRankInfo(xp: number): { nextRank: GemstoneRank | null; xpToNext: number } {
  for (const name of RANK_ORDER) {
    const floor = RANK_THRESHOLDS[name];
    if (xp < floor) return { nextRank: name, xpToNext: floor - xp };
  }
  return { nextRank: null, xpToNext: 0 };
}

function GemIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 3h12l4 6-10 12L2 9l4-6Z"
        fill={color}
        fillOpacity={0.35}
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RankBadge({ rank, size = "md" }: { rank: string; size?: "sm" | "md" | "lg" }) {
  const s = RANK_STYLES[rank] ?? RANK_STYLES.bronze;
  const sizeClass = size === "lg" ? "px-4 py-1.5 text-sm" : size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill,999px)] font-semibold ring-1 ${sizeClass}`}
      style={{ background: s.bg, color: s.fg, boxShadow: `0 0 0 1px ${s.ring} inset` }}
    >
      <GemIcon color={s.fg} />
      {s.label}
    </span>
  );
}

export default RankBadge;
