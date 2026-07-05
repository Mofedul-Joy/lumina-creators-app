"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Pager } from "@/components/admin/Pager";
import { listSubmissions, rejectSubmission, scrapeNow, verifySubmission } from "@/lib/admin";
import { fmtInt, fmtMoney } from "@/lib/format";

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", twitter: "X", facebook: "Facebook",
};
const STATUSES = [
  { key: "", label: "All statuses" },
  { key: "awaiting_stats", label: "Awaiting stats" },
  { key: "proof_uploaded", label: "Proof uploaded" },
  { key: "stats_verified", label: "Stats verified" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
] as const;
const PAGE = 6;

/** "updated 2h ago" freshness label from the Apify stat-updater. */
function agoLabel(iso: string | null): string {
  if (!iso) return "not scraped yet";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `updated ${mins}m ago`;
  const h = Math.floor(mins / 60);
  return h < 48 ? `updated ${h}h ago` : `updated ${Math.floor(h / 24)}d ago`;
}

export function SubmissionsSection({ campaignId }: { campaignId?: string } = {}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // fetch (optionally scoped to one campaign), filter by lifecycle status client-side
  const q = useQuery({
    queryKey: ["dash-submissions", campaignId ?? "all"],
    queryFn: () => listSubmissions(campaignId ? { campaign_id: campaignId } : {}),
    retry: false,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["dash-submissions"] });
  const verifyM = useMutation({ mutationFn: verifySubmission, onSuccess: refresh });
  const [refreshed, setRefreshed] = useState<string | null>(null);
  const scrapeM = useMutation({
    mutationFn: scrapeNow,
    onSuccess: (d) => { setRefreshed(d.id); setTimeout(() => setRefreshed(null), 3000); refresh(); },
  });
  const rejectM = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => rejectSubmission(id, note),
    onSuccess: () => { setRejecting(null); setNote(""); refresh(); },
  });

  const all = q.data ?? [];
  const filtered = useMemo(() => (status ? all.filter((s) => s.status === status) : all), [all, status]);
  const pageCount = Math.ceil(filtered.length / PAGE);
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Submissions</h2>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="min-h-9 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
        >
          {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Loading submissions…</p>
      ) : filtered.length === 0 ? (
        <div className="card-lumina rounded-[var(--radius-card)] p-10 text-center text-sm text-[var(--color-text-secondary)]">No submissions in this view.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((s) => (
              <div key={s.id} className="card-lumina overflow-hidden rounded-[var(--radius-card)]">
                {/* thumbnail placeholder */}
                <a href={s.post_url} target="_blank" rel="noopener noreferrer" className="relative grid aspect-video place-items-center bg-gradient-to-br from-[var(--color-brand)]/25 to-[var(--color-bg-deep)]">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5Z" /></svg>
                  </span>
                  <span className="absolute left-2 top-2"><StatusBadge status={s.status} /></span>
                  <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white">{PLATFORM_LABEL[s.platform] ?? s.platform}</span>
                </a>
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-[var(--color-text)]">{s.creator_name ?? "Unnamed"}</p>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">
                    {s.campaign_name}
                    <span className="float-right">{agoLabel(s.last_scraped_at)}</span>
                  </p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="tabular text-[var(--color-text-secondary)]">{fmtInt(s.views)} views</span>
                      <button
                        title="Refresh stats now (Apify picks it up within a minute)"
                        disabled={scrapeM.isPending}
                        onClick={() => scrapeM.mutate(s.id)}
                        className="cursor-pointer text-[var(--color-text-muted)] transition hover:text-[var(--color-brand)] disabled:opacity-50"
                      >
                        {refreshed === s.id ? "✓ queued" : "↻"}
                      </button>
                    </span>
                    <span className="tabular font-medium text-[var(--color-text)]">{fmtMoney(s.estimated_amount)}</span>
                  </div>
                  {rejecting === s.id ? (
                    <div className="mt-2 space-y-2">
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Reason…" className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs text-[var(--color-text)]" />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setRejecting(null); setNote(""); }} className="cursor-pointer text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Cancel</button>
                        <button disabled={!note.trim() || rejectM.isPending} onClick={() => rejectM.mutate({ id: s.id, note: note.trim() })} className="cursor-pointer rounded-md bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-500/25 disabled:opacity-50">Confirm</button>
                      </div>
                    </div>
                  ) : s.status !== "paid" ? (
                    <div className="mt-2 flex gap-2">
                      {s.status !== "stats_verified" ? (
                        <button disabled={verifyM.isPending} onClick={() => verifyM.mutate(s.id)} className="flex-1 cursor-pointer rounded-md bg-emerald-500/15 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-50">Verify</button>
                      ) : null}
                      {s.status !== "rejected" ? (
                        <button onClick={() => { setRejecting(s.id); setNote(""); }} className="flex-1 cursor-pointer rounded-md py-1 text-xs font-medium text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-red-400 hover:ring-red-500/25">Reject</button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <Pager page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} />
        </>
      )}
    </div>
  );
}
