"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Pager } from "@/components/admin/Pager";
import { EmbedModal } from "@/components/admin/EmbedModal";
import {
  flagSubmissionSuspicious, listSubmissions, rejectSubmission, unflagSubmissionSuspicious,
  verifySubmission, type AdminSubmission,
} from "@/lib/admin";
import { fmtInt, fmtMoney } from "@/lib/format";
import { getEmbedUrl } from "@/lib/embeds";

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

export function SubmissionsSection({ campaignId }: { campaignId?: string } = {}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [previewing, setPreviewing] = useState<AdminSubmission | null>(null);
  const [showFlagged, setShowFlagged] = useState(false);
  const [confirmingFlag, setConfirmingFlag] = useState<string | null>(null);

  // fetch (optionally scoped to one campaign), filter by lifecycle status client-side
  const q = useQuery({
    queryKey: ["dash-submissions", campaignId ?? "all", showFlagged],
    queryFn: () => listSubmissions({ ...(campaignId ? { campaign_id: campaignId } : {}), suspicious: showFlagged || undefined }),
    retry: false,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["dash-submissions"] });
  const verifyM = useMutation({ mutationFn: verifySubmission, onSuccess: refresh });
  const rejectM = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => rejectSubmission(id, note),
    onSuccess: () => { setRejecting(null); setNote(""); refresh(); },
  });
  const flagM = useMutation({
    mutationFn: flagSubmissionSuspicious,
    onSuccess: () => { setConfirmingFlag(null); refresh(); },
  });
  const unflagM = useMutation({ mutationFn: unflagSubmissionSuspicious, onSuccess: refresh });

  const all = q.data ?? [];
  const filtered = useMemo(() => (status ? all.filter((s) => s.status === status) : all), [all, status]);
  const pageCount = Math.ceil(filtered.length / PAGE);
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Submissions</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowFlagged((v) => !v); setPage(1); }}
            className={`min-h-9 cursor-pointer rounded-full px-3 text-sm transition ${showFlagged ? "bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/25" : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
          >
            {showFlagged ? "Showing flagged" : "Show flagged"}
          </button>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="min-h-9 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
          >
            {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Loading submissions…</p>
      ) : filtered.length === 0 ? (
        <div className="card-lumina rounded-[var(--radius-card)] p-10 text-center text-sm text-[var(--color-text-secondary)]">No submissions in this view.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((s) => {
              const embedUrl = getEmbedUrl(s.platform, s.post_url);
              const canPreview = embedUrl && !s.post_unavailable;
              return (
              <div key={s.id} className="card-lumina overflow-hidden rounded-[var(--radius-card)]">
                <button
                  type="button"
                  onClick={() => (canPreview ? setPreviewing(s) : window.open(s.post_url, "_blank"))}
                  className="relative block aspect-video w-full cursor-pointer place-items-center bg-gradient-to-br from-[var(--color-brand)]/25 to-[var(--color-bg-deep)] bg-cover bg-center"
                  style={s.thumbnail_url ? { backgroundImage: `url(${s.thumbnail_url})` } : undefined}
                >
                  <span className="absolute inset-0 grid place-items-center">
                    {s.post_unavailable ? (
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white" title="Post unavailable">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18M10.5 5.5A9.77 9.77 0 0 1 12 5c5 0 9 4 10 7a12.9 12.9 0 0 1-1.7 2.9M6.6 6.6C4.4 8.1 2.9 10.5 2 12c1 3 5 7 10 7 1.6 0 3.1-.4 4.4-1.1" /></svg>
                      </span>
                    ) : (
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5Z" /></svg>
                      </span>
                    )}
                  </span>
                  <span className="absolute left-2 top-2"><StatusBadge status={s.status} /></span>
                  <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white">{PLATFORM_LABEL[s.platform] ?? s.platform}</span>
                  {s.post_unavailable ? (
                    <span className="absolute bottom-2 left-2 rounded-full bg-red-500/80 px-2 py-0.5 text-[10px] font-medium text-white">Post unavailable</span>
                  ) : s.embed_broken ? (
                    <span className="absolute bottom-2 left-2 rounded-full bg-amber-500/80 px-2 py-0.5 text-[10px] font-medium text-white">Tap to view on {PLATFORM_LABEL[s.platform] ?? s.platform}</span>
                  ) : null}
                </button>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-[var(--color-text)]">{s.creator_name ?? "Unnamed"}</p>
                    {(s.is_suspicious || s.creator_is_suspicious) ? (
                      <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                        {s.is_suspicious ? "Suspicious" : "Creator flagged"}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">{s.campaign_name}</p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="tabular text-[var(--color-text-secondary)]">{fmtInt(s.views)} views</span>
                    <span className="tabular font-medium text-[var(--color-text)]">{fmtMoney(s.estimated_amount)}</span>
                  </div>
                  {confirmingFlag === s.id ? (
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <span className="text-xs text-[var(--color-text-secondary)]">Flag this submission?</span>
                      <button onClick={() => setConfirmingFlag(null)} className="cursor-pointer text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Cancel</button>
                      <button disabled={flagM.isPending} onClick={() => flagM.mutate(s.id)} className="cursor-pointer rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/25 disabled:opacity-50">Confirm</button>
                    </div>
                  ) : rejecting === s.id ? (
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
                      {s.is_suspicious ? (
                        <button disabled={unflagM.isPending} onClick={() => unflagM.mutate(s.id)} className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/25 hover:bg-amber-500/10 disabled:opacity-50">Unflag</button>
                      ) : (
                        <button onClick={() => setConfirmingFlag(s.id)} className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-[var(--color-text-muted)] ring-1 ring-inset ring-[var(--color-border)] hover:text-amber-400 hover:ring-amber-500/25" title="Flag submission suspicious">⚑</button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              );
            })}
          </div>
          <Pager page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} />
        </>
      )}
      {previewing ? (
        <EmbedModal
          embedUrl={getEmbedUrl(previewing.platform, previewing.post_url)!}
          postUrl={previewing.post_url}
          onClose={() => setPreviewing(null)}
        />
      ) : null}
    </div>
  );
}
