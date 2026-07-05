import Link from "next/link";
import type { Campaign } from "@/lib/campaigns";
import { fmtMoney } from "@/lib/format";
import { PlatformIcon } from "@/components/ui/PlatformIcon";

const MODE_LABEL: Record<Campaign["mode"], string> = {
  create_new: "Create new",
  copy_paste: "Repost clips",
};

export function CampaignCard({ c }: { c: Campaign }) {
  return (
    <Link
      href={`/campaigns/${c.slug}`}
      className="card-lumina card-interactive group flex flex-col overflow-hidden rounded-[var(--radius-card)]"
    >
      <div className="relative h-28 w-full bg-gradient-to-br from-[var(--color-brand)]/30 to-[var(--color-bg-deep)]">
        {c.brand_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.brand_logo_url} alt="" className="h-full w-full object-cover" />
        ) : null}
        <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2.5 py-0.5 text-[11px] text-white">
          {MODE_LABEL[c.mode]}
        </span>
        {c.joined ? (
          <span className="absolute left-2 top-2 rounded-full bg-[var(--color-brand)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-on-brand)]">
            Joined
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-[var(--color-text-secondary)]">
            {c.brand_name ?? "Lumina campaign"}
          </span>
          <div className="flex shrink-0 items-center gap-1.5 text-[var(--color-text-muted)]">
            {c.platforms.map((p) => (
              <PlatformIcon key={p} name={p} className="h-3.5 w-3.5" />
            ))}
          </div>
        </div>

        <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-brand)]">
          {c.name}
        </h3>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="tabular text-2xl font-semibold text-[var(--color-brand)]">{fmtMoney(c.cpm_rate)}</span>
          <span className="text-sm text-[var(--color-text-muted)]">CPM / 1,000 views</span>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-[var(--color-border)] pt-4">
          <span className="tabular text-xs text-[var(--color-text-muted)]">Budget {fmtMoney(c.budget)}</span>
          <span className="text-sm font-medium text-[var(--color-brand)]">
            {c.joined ? "View campaign" : "Enter campaign"}
          </span>
        </div>
      </div>
    </Link>
  );
}
