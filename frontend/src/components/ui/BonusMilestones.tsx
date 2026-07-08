// Bonus milestone list (Feature 3 wizard step 3) rendered on the native brief
// page (Feature 5). Shows a views-threshold -> bonus-amount ladder, plus an
// optional progress bar against the creator's current view count.
import { fmtInt, fmtMoney } from "@/lib/format";

export type BonusMilestoneLike = {
  id: string;
  views_threshold: number;
  bonus_amount: number | string;
  description?: string | null;
};

export function BonusMilestones({
  milestones,
  currentViews,
}: {
  milestones: BonusMilestoneLike[];
  currentViews?: number;
}) {
  if (!milestones || milestones.length === 0) return null;
  const sorted = [...milestones].sort((a, b) => a.views_threshold - b.views_threshold);
  const maxThreshold = sorted[sorted.length - 1]?.views_threshold ?? 0;

  return (
    <div className="space-y-3">
      {sorted.map((m) => {
        const achieved = currentViews != null && currentViews >= m.views_threshold;
        const pct =
          currentViews != null && maxThreshold > 0
            ? Math.min(100, Math.round((currentViews / m.views_threshold) * 100))
            : null;
        return (
          <div
            key={m.id}
            className={`rounded-[var(--radius-btn)] border p-3 ${
              achieved
                ? "border-[var(--color-brand)]/50 bg-[var(--color-brand)]/10"
                : "border-[var(--color-border)] bg-[var(--color-surface-2)]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[var(--color-text)]">
                {fmtInt(m.views_threshold)}+ views
              </p>
              <p className="tabular text-sm font-semibold text-[var(--color-brand)]">
                +{fmtMoney(m.bonus_amount)}
              </p>
            </div>
            {m.description ? (
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{m.description}</p>
            ) : null}
            {pct != null ? (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface)]">
                <div
                  className="h-full rounded-full bg-[var(--color-brand)] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default BonusMilestones;
