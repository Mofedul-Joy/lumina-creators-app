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

import { fmtInt, fmtMoney } from "@/lib/format";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-grad rounded-[var(--radius-card)] border border-[var(--color-border)] p-5">
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="tabular mt-2 text-2xl font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}

function SubmissionsTable({ campaignId }: { campaignId: string }) {
  const [platform, setPlatform] = useState("all");
  const [exporting, setExporting] = useState(false);
  const q = useQuery({
    queryKey: ["client-subs", campaignId],
    queryFn: () => listClientSubmissions(campaignId),
  });
  if (q.isLoading)
    return <p className="px-5 pb-5 text-sm text-[var(--color-text-muted)]">Loading submissions…</p>;
  if (q.isError)
    return (
      <p className="px-5 pb-5 text-sm text-[var(--color-danger)]">{(q.error as Error).message}</p>
    );
  if (!q.data?.length)
    return <p className="px-5 pb-5 text-sm text-[var(--color-text-muted)]">No submissions yet.</p>;
  const platforms = ["all", ...Array.from(new Set(q.data.map((s) => s.platform)))];
  const rows = platform === "all" ? q.data : q.data.filter((s) => s.platform === platform);
  return (
    <div className="overflow-x-auto px-5 pb-5">
      {/* platform tabs — the Clippers client view pattern */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {platforms.map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`cursor-pointer rounded-full px-3 py-1 text-xs capitalize transition ${
                platform === p
                  ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
            >
              {p}
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
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            <th className="py-2 pr-4 font-medium">Post</th>
            <th className="py-2 pr-4 font-medium">Platform</th>
            <th className="py-2 pr-4 text-right font-medium">Views</th>
            <th className="py-2 pr-4 text-right font-medium">Likes</th>
            <th className="py-2 text-right font-medium">Comments</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-t border-[var(--color-border)]">
              <td className="max-w-[320px] truncate py-2.5 pr-4">
                <a
                  href={s.post_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--color-brand)] hover:underline"
                >
                  {s.post_url}
                </a>
              </td>
              <td className="py-2.5 pr-4 text-[var(--color-text-secondary)]">{s.platform}</td>
              <td className="tabular py-2.5 pr-4 text-right">{fmtInt(s.views)}</td>
              <td className="tabular py-2.5 pr-4 text-right">{fmtInt(s.likes)}</td>
              <td className="tabular py-2.5 text-right">{fmtInt(s.comments)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignCard({ c }: { c: ClientCampaign }) {
  const [open, setOpen] = useState(false);
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
      {open ? <SubmissionsTable campaignId={c.id} /> : null}
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
