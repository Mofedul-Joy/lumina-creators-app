"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { publicApi, type PublicCampaign } from "@/lib/api";
import { fmtMoney } from "@/lib/format";

const MODE_LABEL: Record<PublicCampaign["mode"], string> = {
  create_new: "Create new content",
  copy_paste: "Repost approved clips",
};

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
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          {c.brand_name ?? "Lumina campaign"}
        </span>
        <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)] transition-colors group-hover:text-[var(--color-brand)]">
          {c.name}
        </h3>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="tabular text-2xl font-semibold text-[var(--color-brand)]">{fmtMoney(c.cpm_rate)}</span>
          <span className="text-sm text-[var(--color-text-muted)]">CPM / 1,000 views</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.platforms.map((p) => (
            <span key={p} className="rounded-md bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] capitalize text-[var(--color-text-secondary)]">
              {p}
            </span>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
          <span className="tabular text-xs text-[var(--color-text-muted)]">Budget {fmtMoney(c.budget)}</span>
          <span className="text-sm font-medium text-[var(--color-brand)]">Enter campaign →</span>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const q = useQuery({ queryKey: ["public-campaigns"], queryFn: publicApi.campaigns, refetchInterval: 120_000 });
  const campaigns = q.data ?? [];

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
          No following required — just submit a post from any campaign below and we&apos;ll take it from there.
        </p>

        <div className="mt-8">
          {q.isLoading ? (
            <p className="text-sm text-[var(--color-text-secondary)]">Loading campaigns…</p>
          ) : campaigns.length === 0 ? (
            <div className="card-lumina rounded-[var(--radius-card)] p-10 text-center text-sm text-[var(--color-text-secondary)]">
              No campaigns are live right now — check back soon.
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
