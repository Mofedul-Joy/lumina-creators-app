"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { clearClientToken, getClientToken, setClientToken } from "@/lib/auth";
import { listClientCampaigns, listClientSubmissions, type ClientCampaign } from "@/lib/client";
import { downloadCsv, isAuthError } from "@/lib/api";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { SkeletonCardGrid, SkeletonStats } from "@/components/ui/Skeleton";
import { SubmissionThumbnail } from "@/components/ui/SubmissionThumbnail";
import { fmtInt } from "@/lib/format";
import { LuminaMark } from "@/components/ui/LuminaMark";

const ALL_PLATFORMS = ["tiktok", "instagram", "youtube", "twitter", "facebook"] as const;

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card-grad rounded-[var(--radius-card)] p-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
      <p className={`tabular mt-3 text-3xl font-semibold ${accent ? "text-[var(--color-brand-soft)]" : "text-[var(--color-text)]"}`}>{value}</p>
    </div>
  );
}

// Mirrors the admin submissions section: a prominent filter row (platform icon
// chips + export) over a clean grid of submission cards.
function SubmissionsSection({ campaign }: { campaign: ClientCampaign }) {
  const [platform, setPlatform] = useState("");
  const [exporting, setExporting] = useState(false);
  const q = useQuery({
    queryKey: ["client-subs", campaign.id],
    queryFn: () => listClientSubmissions(campaign.id),
  });

  const rows = useMemo(
    () => (q.data ?? []).filter((s) => !platform || s.platform === platform),
    [q.data, platform],
  );
  // pool of real thumbnails in this campaign, borrowed by cards that lack one
  const thumbPool = useMemo(
    () => (q.data ?? []).map((s) => s.thumbnail_url).filter(Boolean) as string[],
    [q.data],
  );

  return (
    <div className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Submissions</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-[var(--color-surface)] p-1">
            <button
              onClick={() => setPlatform("")}
              className={`min-h-8 cursor-pointer rounded-full px-3 text-xs transition ${platform === "" ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
            >
              All
            </button>
            {ALL_PLATFORMS.filter((p) => campaign.platforms.includes(p)).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(platform === p ? "" : p)}
                aria-label={platformLabel(p)}
                title={platformLabel(p)}
                className={`grid h-8 w-8 cursor-pointer place-items-center rounded-full transition ${platform === p ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
              >
                <PlatformIcon name={p} className="h-4 w-4" />
              </button>
            ))}
          </div>
          <button
            onClick={async () => {
              setExporting(true);
              try { await downloadCsv(`/api/client/campaigns/${campaign.id}/export`, getClientToken() ?? ""); }
              finally { setExporting(false); }
            }}
            disabled={exporting}
            className="min-h-8 cursor-pointer rounded-full border border-[var(--color-border)] px-3.5 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)] disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {q.isLoading ? (
        <SkeletonCardGrid count={6} />
      ) : rows.length === 0 ? (
        <div className="card-lumina rounded-[var(--radius-card)] p-10 text-center text-sm text-[var(--color-text-secondary)]">
          {q.data?.length ? "No submissions on this platform." : "No submissions yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((s) => (
            <a
              key={s.id}
              href={s.post_url}
              target="_blank"
              rel="noreferrer"
              className="card-lumina card-interactive flex flex-col overflow-hidden rounded-[var(--radius-card)]"
            >
              <SubmissionThumbnail
                thumbnailUrl={s.thumbnail_url}
                postUrl={s.post_url}
                platform={s.platform}
                pool={thumbPool}
                className="aspect-video w-full"
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
              </SubmissionThumbnail>
              {/* prominent stat strip — bright values over muted labels so the
                  numbers read clearly against the dark card */}
              <div className="grid grid-cols-3 divide-x divide-[var(--color-border)] bg-[var(--color-surface-2)] text-center">
                <div className="px-2 py-3">
                  <p className="tabular text-base font-semibold text-[var(--color-brand-soft)]">{fmtInt(s.views)}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Views</p>
                </div>
                <div className="px-2 py-3">
                  <p className="tabular text-base font-semibold text-[var(--color-text)]">{fmtInt(s.likes)}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Likes</p>
                </div>
                <div className="px-2 py-3">
                  <p className="tabular text-base font-semibold text-[var(--color-text)]">{fmtInt(s.comments)}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Comments</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    const impersonateToken = sp.get("impersonate_token");
    if (impersonateToken) {
      setClientToken(impersonateToken);
      router.replace("/client/dashboard");
    }
    setHasToken(!!getClientToken());
    setReady(true);
  }, [sp, router]);

  const q = useQuery({
    queryKey: ["client-campaigns"],
    queryFn: listClientCampaigns,
    enabled: ready && hasToken,
    retry: false,
  });

  const campaigns = q.data ?? [];
  // An expired/invalid token should just sign the client out, not dump a raw
  // error onto the dashboard.
  useEffect(() => {
    if (q.isError && isAuthError(q.error)) {
      clearClientToken();
      qc.clear();
      router.replace("/client/login");
    }
  }, [q.isError, q.error, qc, router]);
  useEffect(() => {
    if (campaigns.length && !campaigns.some((c) => c.id === selectedId)) setSelectedId(campaigns[0].id);
  }, [campaigns, selectedId]);
  const selected = campaigns.find((c) => c.id === selectedId) ?? campaigns[0];

  if (ready && !hasToken)
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Please sign in</h1>
        <p className="text-[var(--color-text-secondary)]">Sign in to view your campaign dashboard.</p>
        <Link href="/client/login" className="text-[var(--color-brand)] underline">Go to client sign in</Link>
      </main>
    );

  return (
    <div className="min-h-[100dvh]">
      {/* slim shell, matching the admin top bar */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg-deep)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/client/dashboard" className="flex items-center gap-2">
            <LuminaMark size={28} />
            <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">Lumina <span className="text-[var(--color-text-muted)]">Brand</span></span>
          </Link>
          <button
            className="shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
            onClick={() => { clearClientToken(); qc.clear(); router.push("/client/login"); }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Campaign performance</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Your dashboard</h1>
          </div>
          {campaigns.length > 1 ? (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="min-h-10 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
            >
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : null}
        </div>

        {q.isLoading ? (
          <div className="mt-8 space-y-8"><SkeletonStats count={4} /><SkeletonCardGrid count={6} /></div>
        ) : q.isError ? (
          <p className="mt-8 text-sm text-[var(--color-text-secondary)]">
            {isAuthError(q.error) ? "Signing you out…" : (q.error as Error).message}
          </p>
        ) : !selected ? (
          <div className="card-lumina mt-8 rounded-[var(--radius-card)] p-10 text-center">
            <p className="text-lg font-medium text-[var(--color-text)]">No campaigns yet</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              When Lumina launches a campaign for your brand, its live performance shows up here.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-2">
              <span className="text-lg font-semibold text-[var(--color-text)]">{selected.name}</span>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs capitalize ${selected.status === "active" ? "border-[var(--color-brand)]/40 text-[var(--color-brand)]" : "border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>{selected.status}</span>
            </div>
            {/* client-facing metrics only — no creator count, no ad spend/budget
                (mirrors the clippers client dashboard) */}
            <div className="mt-4 grid grid-cols-3 gap-4">
              <StatTile label="Total views" value={fmtInt(selected.total_views)} accent />
              <StatTile label="Posts" value={fmtInt(selected.submission_count)} />
              <StatTile label="Interactions" value={fmtInt(selected.total_likes + selected.total_comments)} />
            </div>
            <SubmissionsSection campaign={selected} />
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
