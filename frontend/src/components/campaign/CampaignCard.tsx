import Link from "next/link";
import type { Campaign } from "@/lib/campaigns";
import { PlatformIcon } from "@/components/ui/PlatformIcon";
import { campaignImage, campaignTag, payBadge } from "@/lib/campaignTheme";

// Shared card visuals. On the Explore grid we pass `onOpen` so a click opens the
// campaign popup; on the public landing page there's no modal, so it falls back
// to linking straight to the campaign page.
function CardInner({ c }: { c: Campaign }) {
  return (
    <>
      {/* Thumbnail — uploaded banner, else a niche-relevant stock photo */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--color-surface-2)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={campaignImage(c)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
        {/* pay badge (top-right, SideShift-style) */}
        <span className="tabular absolute right-2.5 top-2.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          {payBadge(c)}
        </span>
        {c.joined ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[var(--color-brand)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-on-brand)]">
            Joined
          </span>
        ) : null}
      </div>

      {/* Meta */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-1 text-[15px] font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-brand-soft)]">
          {c.name}
        </h3>
        <div className="mt-2 flex items-center gap-2">
          {c.brand_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.brand_logo_url} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-[10px] text-[var(--color-text-muted)]">
              {(c.brand_name ?? c.name).charAt(0)}
            </span>
          )}
          <span className="truncate text-xs text-[var(--color-text-secondary)]">{c.brand_name ?? "Lumina campaign"}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1 text-[var(--color-text-muted)]">
            {c.platforms.slice(0, 4).map((p) => (
              <PlatformIcon key={p} name={p} className="h-3.5 w-3.5" />
            ))}
          </span>
        </div>
        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-md bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
          {campaignTag(c)}
        </span>
      </div>
    </>
  );
}

export function CampaignCard({ c, onOpen }: { c: Campaign; onOpen?: (c: Campaign) => void }) {
  const cls = "card-lumina card-interactive group flex flex-col overflow-hidden rounded-[var(--radius-card)] text-left";
  if (onOpen) {
    return (
      <button type="button" onClick={() => onOpen(c)} className={`${cls} cursor-pointer`}>
        <CardInner c={c} />
      </button>
    );
  }
  return (
    <Link href={`/campaigns/${c.slug}`} className={cls}>
      <CardInner c={c} />
    </Link>
  );
}
