"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { clearClientToken, getClientToken, setClientToken } from "@/lib/auth";
import {
  listClientCampaigns,
  listClientSubmissions,
  type ClientCampaign,
} from "@/lib/client";
import { downloadCsv } from "@/lib/api";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";

import { fmtInt, fmtMoney } from "@/lib/format";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-grad rounded-[var(--radius-card)] border border-[var(--color-border)] p-5">
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="tabular mt-2 text-2xl font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}

function SubmissionsGrid({ campaignId }: { campaignId: string }) {
  const [platform, setPlatform] = useState("all");
  const [exporting, setExporting] = useState(false);
  const q = useQuery({
    queryKey: ["client-subs", campaignId],
    queryFn: () => listClientSubmissions(campaignId),
  });
  if (q.isLoading)
    return <div className="px-5 pb-5"><SkeletonCardGrid count={3} /></div>;
  if (q.isError)
    return <p className="px-5 pb-5 text-sm text-[var(--color-danger)]">{(q.error as Error).message}</p>;
  if (!q.data?.length)
    return <p className="px-5 pb-5 text-sm text-[var(--color-text-muted)]">No submissions yet.</p>;
  const platforms = ["all", ...Array.from(new Set(q.data.map((s) => s.platform)))];
  const rows = platform === "all" ? q.data : q.data.filter((s) => s.platform === platform);
  return (
    <div className="px-5 pb-5">
      {/* platform icon filters + export */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-full bg-[var(--color-surface)] p-1">
          {platforms.map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              aria-label={p === "all" ? "All" : platformLabel(p)}
              title={p === "all" ? "All" : platformLabel(p)}
              className={`grid h-8 min-w-8 cursor-pointer place-items-center rounded-full px-2 text-xs transition ${
                platform === p ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {p === "all" ? "All" : <PlatformIcon name={p} className="h-4 w-4" />}
            </button>
          ))}
        </div>
        <button
          onClick={async () => {
            setExporting(true);
            try { await downloadCsv(`/api/client/campaigns/${campaignId}/export`, getClientToken() ?? ""); }
            finally { setExporting(false); }
          }}
          disabled={exporting}
          className="cursor-pointer rounded-full px-3 py-1 text-xs text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-[var(--color-text)] disabled:opacity-50"
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((s) => (
          <a
            key={s.id}
            href={s.post_url}
            target="_blank"
            rel="noreferrer"
            className="card-lumina card-interactive flex flex-col overflow-hidden rounded-[var(--radius-card)]"
          >
            <div
              className="relative aspect-video w-full bg-gradient-to-br from-[var(--color-brand)]/25 to-[var(--color-bg-deep)] bg-cover bg-center"
              style={s.thumbnail_url ? { backgroundImage: `url(${s.thumbnail_url})` } : undefined}
            >
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5Z" /></svg>
                </span>
              </span>
              <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white">
                <PlatformIcon name={s.platform} className="h-3.5 w-3.5" />
              </span>
              {s.post_unavailable ? (
                <span className="absolute bottom-2 left-2 rounded-full bg-red-500/80 px-2 py-0.5 text-[10px] font-medium text-white">Unavailable</span>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-2 bg-[var(--color-surface-2)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">
              <span className="tabular">{fmtInt(s.views)} views</span>
              <span className="tabular">{fmtInt(s.likes)} likes</span>
              <span className="tabular">{fmtInt(s.comments)} comments</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function CampaignCard({ c }: { c: ClientCampaign }) {
  // Submissions grid is the default client view (open), matching the admin
  // section — collapse is available but the grid shows straight away.
  const [open, setOpen] = useState(true);
  return (
    <div className="card-lumina rounded-[var(--radius-card)]">
      <button
        className="w-full cursor-pointer p-5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">{c.name}</h2>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                  c.status === "active"
                    ? "border-[var(--color-brand)]/40 text-[var(--color-brand)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                }`}
              >
                {c.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {c.mode === "create_new" ? "Original UGC" : "Approved clips"} ·{" "}
              {c.platforms.join(", ") || "all platforms"}
            </p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Views</p>
              <p className="tabular text-lg font-semibold text-[var(--color-brand-soft)]">
                {fmtInt(c.total_views)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Posts</p>
              <p className="tabular text-lg font-semibold">{fmtInt(c.submission_count)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Creators</p>
              <p className="tabular text-lg font-semibold">{fmtInt(c.creator_count)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Spent / budget</p>
              <p className="tabular text-lg font-semibold">
                {fmtMoney(c.spent_amount)}{" "}
                <span className="text-sm font-normal text-[var(--color-text-muted)]">
                  / {fmtMoney(c.budget)}
                </span>
              </p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          {open ? "Hide submissions ▲" : "Show submissions ▼"}
        </p>
      </button>
      {open ? <SubmissionsGrid campaignId={c.id} /> : null}
    </div>
  );
}

function DashboardInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => {
    // Admin "View as Client" lands here with a short-lived token in the URL —
    // consume it into this domain's own token storage, then drop it from the
    // URL so it never lingers in browser history/bookmarks.
    const impersonateToken = sp.get("impersonate_token");
    if (impersonateToken) {
      setClientToken(impersonateToken);
      router.replace("/client/dashboard");
    }
    setHasToken(!!getClientToken());
    setReady(true);
  }, [sp, router]);

  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["client-campaigns"],
    queryFn: listClientCampaigns,
    enabled: ready && hasToken,
    retry: false,
  });

  if (ready && !hasToken)
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Please sign in</h1>
        <p className="text-[var(--color-text-secondary)]">
          Sign in to view your campaign dashboard.
        </p>
        <Link href="/client/login" className="text-[var(--color-brand)] underline">
          Go to client sign in
        </Link>
      </main>
    );

  const campaigns = q.data ?? [];
  const totals = campaigns.reduce(
    (acc, c) => ({
      views: acc.views + c.total_views,
      posts: acc.posts + c.submission_count,
      creators: acc.creators + c.creator_count,
      spent: acc.spent + Number(c.spent_amount),
    }),
    { views: 0, posts: 0, creators: 0, spent: 0 },
  );

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/client/dashboard" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-brand)] text-[var(--color-on-brand)]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M8 5v14l11-7L8 5Z" fill="currentColor" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">
              Lumina <span className="text-[var(--color-text-muted)]">Brand</span>
            </span>
          </Link>
          <button
            className="cursor-pointer rounded-full px-3.5 py-1.5 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
            onClick={() => {
              clearClientToken();
              qc.clear();
              router.push("/client/login");
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm font-medium text-[var(--color-brand)]">Campaign performance</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--color-text)]">
          Your dashboard
        </h1>

        {q.isLoading ? (
          <p className="mt-8 text-[var(--color-text-muted)]">Loading campaigns…</p>
        ) : q.isError ? (
          <p className="mt-8 text-sm text-[var(--color-danger)]">{(q.error as Error).message}</p>
        ) : campaigns.length === 0 ? (
          <div className="card-grad mt-8 rounded-[var(--radius-card)] border border-[var(--color-border)] p-10 text-center">
            <p className="text-lg font-medium text-[var(--color-text)]">No campaigns yet</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              When Lumina launches a campaign for your brand, its live performance shows up here.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile label="Total views" value={fmtInt(totals.views)} />
              <StatTile label="Posts" value={fmtInt(totals.posts)} />
              <StatTile label="Creators" value={fmtInt(totals.creators)} />
              <StatTile label="Spent" value={fmtMoney(totals.spent)} />
            </div>
            <div className="mt-8 space-y-4">
              {campaigns.map((c) => (
                <CampaignCard key={c.id} c={c} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function ClientDashboardPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[100dvh] items-center justify-center"><p className="text-sm text-[var(--color-text-secondary)]">Loading…</p></main>}>
      <DashboardInner />
    </Suspense>
  );
}
