"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { publicApi, type PublicCampaign } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";

const MODE_LABEL: Record<PublicCampaign["mode"], string> = {
  create_new: "Create new content",
  copy_paste: "Repost approved clips",
};
const ALL_PLATFORMS = ["tiktok", "instagram", "youtube", "twitter", "facebook"] as const;

function CampaignCard({ c }: { c: PublicCampaign }) {
  return (
    <Link
      href={`/c/${c.slug}`}
      className="card-lumina card-interactive group flex flex-col overflow-hidden rounded-[var(--radius-card)]"
    >
      <div className="relative h-32 w-full bg-gradient-to-br from-[var(--color-brand)]/30 to-[var(--color-bg-deep)]">
        {c.brand_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.brand_logo_url} alt="" className="h-full w-full object-cover" />
        ) : null}
        <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2.5 py-0.5 text-[11px] font-medium text-white">
          {MODE_LABEL[c.mode]}
        </span>
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
        <div className="mt-auto pt-5">
          <span className="flex min-h-10 w-full items-center justify-center rounded-full bg-[var(--color-brand)] text-sm font-semibold text-[var(--color-on-brand)] transition group-hover:bg-[var(--color-brand-hover)]">
            Enter campaign
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const q = useQuery({ queryKey: ["public-campaigns"], queryFn: publicApi.campaigns, refetchInterval: 120_000 });
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<string>("");

  const campaigns = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (q.data ?? []).filter((c) => {
      if (platform && !c.platforms.includes(platform)) return false;
      if (term && !`${c.name} ${c.brand_name ?? ""}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [q.data, search, platform]);

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg-deep)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-brand)] text-[var(--color-on-brand)]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M8 5v14l11-7L8 5Z" fill="currentColor" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">Lumina Creators</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-9 items-center rounded-full border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-brand)]"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Live campaigns</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">
          Pick a campaign, post, get paid.
        </h1>
        <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
          No following required. Submit a post from any campaign below and we&apos;ll take it from there.
        </p>

        {/* search + platform-icon filters */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for a campaign..."
              className="min-h-10 w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] pl-10 pr-4 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
            />
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-[var(--color-surface)] p-1">
            <button
              onClick={() => setPlatform("")}
              className={`min-h-8 cursor-pointer rounded-full px-3 text-xs transition ${
                platform === "" ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              All
            </button>
            {ALL_PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(platform === p ? "" : p)}
                aria-label={platformLabel(p)}
                title={platformLabel(p)}
                className={`grid h-8 w-8 cursor-pointer place-items-center rounded-full transition ${
                  platform === p ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                <PlatformIcon name={p} className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          {q.isLoading ? (
            <SkeletonCardGrid count={6} />
          ) : campaigns.length === 0 ? (
            <div className="card-lumina rounded-[var(--radius-card)] p-10 text-center text-sm text-[var(--color-text-secondary)]">
              {q.data?.length ? "No campaigns match your filters." : "No campaigns are live right now. Check back soon."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((c) => (
                <CampaignCard key={c.id} c={c} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
