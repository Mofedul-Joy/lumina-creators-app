import Link from "next/link";
import type { Campaign } from "@/lib/campaigns";
import { fmtMoney } from "@/lib/format";

const MODE_LABEL: Record<Campaign["mode"], string> = {
  create_new: "Create new",
  copy_paste: "Repost clips",
};

export function CampaignCard({ c }: { c: Campaign }) {
  return (
    <Link
      href={`/campaigns/${c.slug}`}
      className="card-lumina card-interactive group flex flex-col rounded-[var(--radius-card)] p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          {c.brand_name ?? "Lumina campaign"}
        </span>
        <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
          {MODE_LABEL[c.mode]}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-brand)]">
        {c.name}
      </h3>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="tabular text-2xl font-semibold text-[var(--color-brand)]">
          {fmtMoney(c.cpm_rate)}
        </span>
        <span className="text-sm text-[var(--color-text-muted)]">CPM / 1,000 views</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {c.platforms.map((p) => (
          <span
            key={p}
            className="rounded-md bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]"
          >
            {p}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
        <span className="tabular text-xs text-[var(--color-text-muted)]">
          Budget {fmtMoney(c.budget)}
        </span>
        <span className="text-sm font-medium text-[var(--color-brand)]">
          {c.joined ? "Joined ✓" : "Enter campaign →"}
        </span>
      </div>
    </Link>
  );
}
