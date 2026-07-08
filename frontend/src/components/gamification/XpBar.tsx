// XP progress bar toward the next gemstone rank (Feature 7). Green gradient
// fill on a dark track, matching the brand's green-first dark theme.
import { RANK_STYLES } from "@/components/gamification/RankBadge";

export function XpBar({
  xp,
  xpToNext,
  nextRank,
}: {
  xp: number;
  xpToNext: number;
  nextRank: string | null;
}) {
  // xpToNext is "xp still needed"; reconstruct a 0-100 progress toward it.
  const target = xp + Math.max(xpToNext, 0);
  const pct = target > 0 ? Math.min(100, Math.round((xp / target) * 100)) : 100;
  const nextStyle = nextRank ? RANK_STYLES[nextRank] : null;

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span className="tabular font-medium text-[var(--color-text)]">{xp.toLocaleString()} XP</span>
        {nextRank ? (
          <span>
            {xpToNext.toLocaleString()} XP to <span style={{ color: nextStyle?.fg }}>{nextStyle?.label ?? nextRank}</span>
          </span>
        ) : (
          <span className="text-[var(--color-brand)]">Max rank reached</span>
        )}
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-brand-soft,#86efac)] transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default XpBar;
