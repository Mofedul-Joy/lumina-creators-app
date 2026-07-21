"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PlatformIcon } from "@/components/ui/PlatformIcon";
import { SubmissionDetailModal } from "@/components/admin/SubmissionDetailModal";
import { getAdminToken } from "@/lib/auth";
import { isAuthError, retryNonAuth} from "@/lib/api";
import { getSubmissionCounts, listSubmissions, type AdminSubmission } from "@/lib/admin";
import { fmtInt } from "@/lib/format";

// UI tab → backend verification_status. "" = all.
const TABS = [
  { key: "", label: "All" },
  { key: "revision_requested", label: "Revisions Needed" },
  { key: "pending", label: "Pending" },
  { key: "verified", label: "Approved" },
  { key: "rejected", label: "Rejected" },
] as const;

const MODE_LABEL: Record<string, string> = {
  create_new: "Original UGC",
  copy_paste: "Approved clip",
};

function initials(name: string | null): string {
  const n = (name ?? "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** One submitted video: its thumbnail up top, the creator's profile below —
 * the whole card opens the in-app review modal. */
function VideoCard({ s, onOpen }: { s: AdminSubmission; onOpen: () => void }) {
  // Thumbnails are cached on our own storage server-side (rehosted to R2), so a
  // load failure is rare — but if a URL ever breaks, degrade to the platform
  // icon instead of the browser's broken-image glyph. Reset when the URL changes.
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [s.thumbnail_url]);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] text-left transition hover:border-[var(--color-brand)]/60 hover:shadow-lg"
    >
      {/* thumbnail */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--color-surface-2)]">
        {s.thumbnail_url && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.thumbnail_url}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center gap-2 bg-gradient-to-br from-[var(--color-surface-2)] to-[var(--color-surface)] text-[var(--color-text-muted)]">
            <PlatformIcon name={s.platform} className="h-9 w-9 opacity-40" />
            <span className="text-[11px] font-medium uppercase tracking-wide opacity-60">{s.platform}</span>
          </div>
        )}
        {/* play overlay */}
        <div className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/30">
          <span className="grid h-11 w-11 scale-90 place-items-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition group-hover:scale-100 group-hover:opacity-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5Z" /></svg>
          </span>
        </div>
        {/* platform + status chips */}
        <span className="absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm">
          <PlatformIcon name={s.platform} className="h-3.5 w-3.5" />
        </span>
        <span className="absolute right-2 top-2">
          <StatusBadge status={s.verification_status} />
        </span>
      </div>
      {/* creator profile */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/15 text-xs font-semibold text-[var(--color-brand-soft)]">
          {initials(s.creator_name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--color-text)]">{s.creator_name ?? "Unnamed"}</p>
          <p className="truncate text-xs text-[var(--color-text-muted)]">{fmtInt(s.views)} views</p>
        </div>
      </div>
    </button>
  );
}

function VideoReviewInner() {
  const router = useRouter();
  const qc = useQueryClient();
  const sp = useSearchParams();
  const urlStatus = sp.get("status");
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  // Rhys 2026-07-21: submissions now land in Pending awaiting an admin, so that
  // is the queue this page should open on — not the undifferentiated All grid.
  const [filter, setFilter] = useState<string>(urlStatus ?? "pending");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("");  // "", instagram, tiktok, youtube
  const [page, setPage] = useState(0);
  useEffect(() => { if (urlStatus !== null) setFilter(urlStatus); }, [urlStatus]);
  // Any filter change resets to the first page.
  useEffect(() => { setPage(0); }, [filter, campaignFilter, platformFilter]);
  const [detail, setDetail] = useState<AdminSubmission | null>(null);

  useEffect(() => {
    setHasToken(!!getAdminToken());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !hasToken) router.replace("/admin/login");
  }, [ready, hasToken, router]);

  const enabled = ready && hasToken;
  const countsQ = useQuery({ queryKey: ["sub-counts"], queryFn: getSubmissionCounts, enabled, retry: retryNonAuth });
  const listQ = useQuery({
    queryKey: ["video-review", filter],
    queryFn: () => listSubmissions({ status: filter || undefined }),
    enabled,
    retry: retryNonAuth,
  });
  useEffect(() => {
    if (listQ.isError && isAuthError(listQ.error)) router.replace("/admin/login");
  }, [listQ.isError, listQ.error, router]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["video-review"] });
    qc.invalidateQueries({ queryKey: ["sub-counts"] });
    qc.invalidateQueries({ queryKey: ["dash-submissions"] });
  };

  // The distinct campaigns present (for the dropdown). Rhys 2026-07-21:
  // "just all campaigns here, alphabetical order."
  const campaigns = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of listQ.data ?? []) if (!map.has(s.campaign_id)) map.set(s.campaign_id, s.campaign_name);
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }));
  }, [listQ.data]);

  // Bill: the "All campaigns" view is a FLAT, mixed grid (no per-campaign
  // subheadings) — the campaign dropdown filters, the platform icons filter, and
  // pagination keeps it to a few rows on screen at a time.
  const PAGE_SIZE = 12;  // 4 across × 3 rows
  const filteredRows = useMemo(() => {
    return (listQ.data ?? []).filter((s) =>
      (campaignFilter === "all" || s.campaign_id === campaignFilter) &&
      (!platformFilter || s.platform === platformFilter)
    );
  }, [listQ.data, campaignFilter, platformFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filteredRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const PLATFORM_FILTERS = ["instagram", "tiktok", "youtube"] as const;

  if (!ready || !hasToken)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );

  const c = countsQ.data;
  const total = c ? c.pending + c.verified + c.rejected + c.revision_requested : undefined;
  const countFor = (k: string) =>
    k === "" ? total
    : k === "pending" ? c?.pending
    : k === "verified" ? c?.verified
    : k === "rejected" ? c?.rejected
    : k === "revision_requested" ? c?.revision_requested
    : undefined;

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Submissions</h1>
        <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
          Every video creators submitted. Filter by campaign or platform, and page through the grid.
        </p>

        {/* status tabs + campaign jump */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {TABS.map((t) => {
            const active = filter === t.key;
            const n = countFor(t.key);
            return (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`cursor-pointer rounded-full px-4 py-1.5 text-sm transition ${
                  active
                    ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
              >
                {t.label}
                {n !== undefined ? <span className="tabular ml-1.5 opacity-70">{n}</span> : null}
              </button>
            );
          })}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* platform filter — click an icon to show only that platform's posts */}
            <div className="flex items-center gap-1 rounded-full bg-[var(--color-surface)] p-1">
              {PLATFORM_FILTERS.map((p) => {
                const on = platformFilter === p;
                return (
                  <button
                    key={p}
                    onClick={() => setPlatformFilter(on ? "" : p)}
                    aria-label={`Show ${p} only`}
                    title={`Show ${p} only`}
                    aria-pressed={on}
                    className={`grid h-8 w-8 cursor-pointer place-items-center rounded-full transition ${
                      on ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    <PlatformIcon name={p} className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
            {campaigns.length > 0 ? (
              <select
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                aria-label="Filter by campaign"
                className="cursor-pointer rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
              >
                <option value="all">All campaigns</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : null}
          </div>
        </div>

        {/* flat, mixed grid — no per-campaign subheadings; 4 across, paginated */}
        {listQ.isLoading ? (
          <p className="mt-10 text-sm text-[var(--color-text-secondary)]">Loading videos…</p>
        ) : filteredRows.length === 0 ? (
          <div className="card-lumina mt-6 rounded-[var(--radius-card)] p-12 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">No videos in this view.</p>
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {pageRows.map((s) => (
                <VideoCard key={s.id} s={s} onOpen={() => setDetail(s)} />
              ))}
            </div>

            {pageCount > 1 ? (
              <div className="mt-8 flex items-center justify-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="cursor-pointer rounded-full border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)] disabled:opacity-40"
                >
                  ← Prev
                </button>
                {Array.from({ length: pageCount }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    aria-current={i === safePage}
                    className={`min-w-9 cursor-pointer rounded-full px-3 py-1.5 text-sm transition ${
                      i === safePage
                        ? "bg-[var(--color-brand)] font-semibold text-[var(--color-on-brand)]"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={safePage >= pageCount - 1}
                  className="cursor-pointer rounded-full border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)] disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            ) : null}
          </>
        )}
      </main>

      {detail ? (
        <SubmissionDetailModal sub={detail} onClose={() => { setDetail(null); refresh(); }} />
      ) : null}
    </div>
  );
}

export default function AdminVideoReviewPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[100dvh] items-center justify-center"><p className="text-sm text-[var(--color-text-secondary)]">Loading…</p></main>}>
      <VideoReviewInner />
    </Suspense>
  );
}
