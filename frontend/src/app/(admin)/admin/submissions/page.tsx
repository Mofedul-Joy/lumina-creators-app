"use client";

import { Suspense, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Pager } from "@/components/admin/Pager";
import { getAdminToken } from "@/lib/auth";
import { getSubmissionCounts, listSubmissions, rejectSubmission, verifySubmission, type AdminSubmission } from "@/lib/admin";
import { SubmissionDetailModal } from "@/components/admin/SubmissionDetailModal";
import { isAuthError } from "@/lib/api";
import { fmtInt, fmtMoney } from "@/lib/format";

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "X",
  facebook: "Facebook",
};

const FILTERS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "revision_requested", label: "Revisions" },
  { key: "verified", label: "Verified" },
  { key: "rejected", label: "Rejected" },
] as const;

function SubmissionsInner() {
  const router = useRouter();
  const qc = useQueryClient();
  const sp = useSearchParams();
  const urlStatus = sp.get("status");
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [filter, setFilter] = useState<string>(urlStatus ?? "pending");
  // let the nav dropdown links (?status=…) drive the filter
  useEffect(() => { if (urlStatus !== null) setFilter(urlStatus); }, [urlStatus]);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [detail, setDetail] = useState<AdminSubmission | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    setHasToken(!!getAdminToken());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !hasToken) router.replace("/admin/login");
  }, [ready, hasToken, router]);

  const enabled = ready && hasToken;
  const countsQ = useQuery({ queryKey: ["sub-counts"], queryFn: getSubmissionCounts, enabled, retry: false });
  const listQ = useQuery({
    queryKey: ["submissions", filter],
    queryFn: () => listSubmissions({ status: filter || undefined }),
    enabled,
    retry: false,
  });
  useEffect(() => {
    if (listQ.isError && isAuthError(listQ.error)) router.replace("/admin/login");
  }, [listQ.isError, listQ.error, router]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["submissions"] });
    qc.invalidateQueries({ queryKey: ["sub-counts"] });
  };
  const verifyM = useMutation({ mutationFn: verifySubmission, onSuccess: refresh });
  const rejectM = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => rejectSubmission(id, note),
    onSuccess: () => {
      setRejecting(null);
      setNote("");
      refresh();
    },
  });

  if (!ready || !hasToken)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );

  const rows = listQ.data ?? [];
  const pageCount = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const c = countsQ.data;

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Submissions</h1>
        <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
          Review posted clips, verify original-content proof, and gate what becomes payable.
        </p>
        <AdminTabs />

        {/* filter chips with counts */}
        <div className="mt-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const n = f.key === "pending" ? c?.pending : f.key === "verified" ? c?.verified : f.key === "rejected" ? c?.rejected : f.key === "revision_requested" ? c?.revision_requested : undefined;
            return (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setPage(1); }}
                className={`cursor-pointer rounded-full px-4 py-1.5 text-sm transition ${
                  active
                    ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
              >
                {f.label}
                {n !== undefined ? <span className="tabular ml-1.5 opacity-70">{n}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="card-lumina mt-6 overflow-hidden rounded-[var(--radius-card)]">
          {listQ.isLoading ? (
            <p className="p-6 text-sm text-[var(--color-text-secondary)]">Loading submissions…</p>
          ) : rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-[var(--color-text-secondary)]">No submissions in this view.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                    <th className="px-5 py-3 font-medium">Creator</th>
                    <th className="px-5 py-3 font-medium">Campaign</th>
                    <th className="px-5 py-3 text-right font-medium">Views</th>
                    <th className="px-5 py-3 text-right font-medium">Est. earning</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((s) => (
                    <tr key={s.id} className="border-b border-[var(--color-border)]/40 last:border-0 align-top">
                      <td className="px-5 py-4">
                        <div className="font-medium text-[var(--color-text)]">{s.creator_name ?? "Unnamed"}</div>
                        <a href={s.post_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-brand)] hover:underline">
                          {PLATFORM_LABEL[s.platform] ?? s.platform} post ↗
                        </a>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-[var(--color-text)]">{s.campaign_name}</div>
                        <div className="mt-1">
                          <span className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                            {s.campaign_mode === "create_new" ? "Original UGC" : "Approved clip"}
                          </span>
                        </div>
                      </td>
                      <td className="tabular px-5 py-4 text-right text-[var(--color-text-secondary)]">{fmtInt(s.views)}</td>
                      <td className="tabular px-5 py-4 text-right text-[var(--color-text)]">{fmtMoney(s.estimated_amount)}</td>
                      <td className="px-5 py-4">
                        <StatusBadge status={s.verification_status} />
                        {s.verification_note ? (
                          <p className="mt-1 max-w-[180px] text-xs text-[var(--color-text-muted)]">{s.verification_note}</p>
                        ) : null}
                        {s.proof_url ? (
                          <a href={s.proof_url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-xs text-[var(--color-brand)] hover:underline">
                            Proof video ↗
                          </a>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {rejecting === s.id ? (
                          <div className="ml-auto flex max-w-[240px] flex-col gap-2">
                            <textarea
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              placeholder="Reason (shown to the creator)…"
                              rows={2}
                              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs text-[var(--color-text)]"
                            />
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setRejecting(null); setNote(""); }} className="cursor-pointer text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                                Cancel
                              </button>
                              <button
                                disabled={!note.trim() || rejectM.isPending}
                                onClick={() => rejectM.mutate({ id: s.id, note: note.trim() })}
                                className="cursor-pointer rounded-md bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-500/25 hover:bg-red-500/25 disabled:opacity-50"
                              >
                                Confirm reject
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setDetail(s)}
                              className="cursor-pointer rounded-md bg-[var(--color-brand)]/15 px-2.5 py-1 text-xs font-medium text-[var(--color-brand-soft)] ring-1 ring-inset ring-[var(--color-brand)]/25 hover:bg-[var(--color-brand)]/25"
                            >
                              Watch
                            </button>
                            {s.verification_status !== "verified" ? (
                              <button
                                disabled={verifyM.isPending}
                                onClick={() => verifyM.mutate(s.id)}
                                className="cursor-pointer rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-50"
                              >
                                Verify
                              </button>
                            ) : null}
                            {s.verification_status !== "rejected" ? (
                              <button
                                onClick={() => { setRejecting(s.id); setNote(""); }}
                                className="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-red-400 hover:ring-red-500/25"
                              >
                                Reject
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Pager page={page} pageCount={pageCount} onPage={setPage} total={rows.length} />
      </main>
      {detail ? (
        <SubmissionDetailModal sub={detail} onClose={() => { setDetail(null); refresh(); }} />
      ) : null}
    </div>
  );
}

export default function AdminSubmissionsPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[100dvh] items-center justify-center"><p className="text-sm text-[var(--color-text-secondary)]">Loading…</p></main>}>
      <SubmissionsInner />
    </Suspense>
  );
}
