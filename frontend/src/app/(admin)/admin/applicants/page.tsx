"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Avatar } from "@/components/admin/Avatar";
import { CreatorDetailCard } from "@/components/admin/CreatorDetailCard";
import { getAdminToken } from "@/lib/auth";
import { isAuthError } from "@/lib/api";
import {
  listApplicants,
  getApplicantCounts,
  getApplicantDetail,
  updateApplicant,
  applicantsExportCsvUrl,
  type ApplicantListItem,
  type ApplicantDetail,
  type ApplicantCounts,
} from "@/lib/admin";

const control =
  "min-h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]";

type TabKey = "new" | "reviewed" | "messaged" | "declined" | "bookmarked" | "accepted";

const TABS: { key: TabKey; label: string }[] = [
  { key: "new", label: "New" },
  { key: "reviewed", label: "Reviewed" },
  { key: "messaged", label: "Messaged" },
  { key: "declined", label: "Declined" },
  { key: "bookmarked", label: "Bookmarked" },
  { key: "accepted", label: "Accepted" },
];

function fmtNumber(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  if (!Number.isFinite(v)) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

function fmtMoney(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  return `$${Number.isFinite(v) ? v.toFixed(2) : "0.00"}`;
}

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function AdminApplicantsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { setToken(getAdminToken()); setReady(true); }, []);
  useEffect(() => { if (ready && !token) router.replace("/admin/login"); }, [ready, token, router]);

  const [campaignId, setCampaignId] = useState<string>("");
  const [tab, setTab] = useState<TabKey>("new");
  const [search, setSearch] = useState("");
  const dSearch = useDebounced(search);
  const [openId, setOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  // Campaign list, reused for the header selector. Falls back to "All campaigns".
  const campaignsQ = useQuery({
    queryKey: ["admin-campaigns-lite"],
    queryFn: async () => {
      const { apiFetch } = await import("@/lib/api");
      return apiFetch<{ id: string; name: string }[]>("/api/admin/campaigns", { token: token ?? undefined });
    },
    enabled: ready && !!token,
    retry: false,
  });

  const countsQ = useQuery({
    queryKey: ["admin-applicant-counts", campaignId],
    queryFn: () => getApplicantCounts(campaignId || undefined),
    enabled: ready && !!token,
    retry: false,
    refetchInterval: 30_000,
  });

  const listQ = useQuery({
    queryKey: ["admin-applicants", campaignId, tab, dSearch],
    queryFn: () =>
      listApplicants({
        campaign_id: campaignId || undefined,
        status: tab,
        search: dSearch.trim() || undefined,
        limit: 200,
      }),
    enabled: ready && !!token,
    retry: false,
  });

  useEffect(() => {
    if ((listQ.isError && isAuthError(listQ.error)) || (countsQ.isError && isAuthError(countsQ.error))) {
      router.replace("/admin/login");
    }
  }, [listQ.isError, listQ.error, countsQ.isError, countsQ.error, router]);

  const detailQ = useQuery({
    queryKey: ["admin-applicant-detail", openId],
    queryFn: () => getApplicantDetail(openId as string),
    enabled: ready && !!token && !!openId,
    retry: false,
  });

  useEffect(() => {
    setNoteDraft(detailQ.data?.admin_note ?? "");
  }, [detailQ.data?.admin_note]);

  const rows: ApplicantListItem[] = listQ.data ?? [];
  const counts: ApplicantCounts | undefined = countsQ.data;

  const countFor = (key: TabKey): number => (counts ? counts[key] ?? 0 : 0);

  async function applyStatus(id: string, status: TabKey | "accepted") {
    // Optimistic update: drop the row from the current tab immediately.
    qc.setQueryData<ApplicantListItem[]>(["admin-applicants", campaignId, tab, dSearch], (old) =>
      (old ?? []).filter((r) => r.id !== id),
    );
    qc.setQueryData<ApplicantCounts | undefined>(["admin-applicant-counts", campaignId], (old) =>
      old ? { ...old, [tab]: Math.max(0, (old[tab] ?? 0) - 1), [status]: (old[status] ?? 0) + 1 } : old,
    );
    try {
      await updateApplicant(id, { status });
    } finally {
      qc.invalidateQueries({ queryKey: ["admin-applicants"] });
      qc.invalidateQueries({ queryKey: ["admin-applicant-counts"] });
      if (openId === id) qc.invalidateQueries({ queryKey: ["admin-applicant-detail", id] });
    }
  }

  async function saveNote() {
    if (!openId) return;
    await updateApplicant(openId, { admin_note: noteDraft });
    qc.invalidateQueries({ queryKey: ["admin-applicant-detail", openId] });
    qc.invalidateQueries({ queryKey: ["admin-applicants"] });
  }

  const campaignOptions = useMemo(() => campaignsQ.data ?? [], [campaignsQ.data]);
  const detail: ApplicantDetail | undefined = detailQ.data;

  if (!ready || !token)
    return <main className="flex min-h-[100dvh] items-center justify-center"><p className="text-sm text-[var(--color-text-secondary)]">Loading…</p></main>;

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Operations Terminal</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Applicants</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">Review, message, decline, bookmark, or accept campaign applicants.</p>
        <AdminTabs />

        {/* header controls */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <select
            className={control}
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            <option value="">All campaigns</option>
            {campaignOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <input
            className={`${control} min-w-[220px] flex-1`}
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <a
            href={applicantsExportCsvUrl({ campaign_id: campaignId || undefined, status: tab })}
            className="inline-flex min-h-10 items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-brand)]"
          >
            Export CSV
          </a>

          <button
            onClick={() => { listQ.refetch(); countsQ.refetch(); }}
            className="inline-flex min-h-10 items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-brand)]"
          >
            Refresh
          </button>
        </div>

        {/* pipeline tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand)]/60"
                }`}
              >
                {t.label}
                <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "bg-[var(--color-surface)] text-[var(--color-text-muted)]"}`}>
                  {countFor(t.key)}
                </span>
              </button>
            );
          })}
        </div>

        {/* card grid */}
        {listQ.isLoading ? (
          <p className="mt-10 text-sm text-[var(--color-text-secondary)]">Loading applicants…</p>
        ) : rows.length === 0 ? (
          <p className="mt-10 text-sm text-[var(--color-text-secondary)]">No applicants in this stage yet.</p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(r.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(r.id); } }}
                className="card-lumina group relative flex cursor-pointer flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/50 p-5 text-left transition-all hover:border-[var(--color-brand)]/60 hover:shadow-[0_0_0_1px_rgba(34,197,94,0.35),0_18px_40px_-20px_rgba(34,197,94,0.45)]"
              >
                <div className="flex items-center gap-3">
                  <Avatar url={r.avatar_url} name={r.display_name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--color-text)]">{r.display_name ?? "Unnamed"}</p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">{r.campaign_name}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {r.platforms?.map((p) => (
                    <span key={p} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                      {p}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-3 text-center">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{fmtNumber(r.views)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Views</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{fmtMoney(r.earnings)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Earned</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">{r.country ?? "—"}</p>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Country</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
                  <button onClick={(e) => { e.stopPropagation(); applyStatus(r.id, "messaged"); }}
                    className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]">Message</button>
                  <button onClick={(e) => { e.stopPropagation(); applyStatus(r.id, "bookmarked"); }}
                    className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]">Bookmark</button>
                  <button onClick={(e) => { e.stopPropagation(); applyStatus(r.id, "accepted"); }}
                    className="rounded-lg border border-[var(--color-brand)]/50 bg-[var(--color-brand)]/10 px-2.5 py-1 text-xs text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20">Accept</button>
                  <button onClick={(e) => { e.stopPropagation(); applyStatus(r.id, "declined"); }}
                    className="rounded-lg border border-[var(--color-danger)]/40 px-2.5 py-1 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10">Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* slide-over detail drawer */}
      {openId ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpenId(null)} />
          <div className="relative flex h-full w-full max-w-[640px] flex-col overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg-deep)] p-6 shadow-2xl">
            <button onClick={() => setOpenId(null)} className="self-end rounded-lg border border-[var(--color-border)] px-3 py-1 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-brand)]">Close</button>

            {detailQ.isLoading || !detail ? (
              <p className="mt-10 text-sm text-[var(--color-text-secondary)]">Loading applicant…</p>
            ) : (
              <>
                <p className="mt-4 text-xs text-[var(--color-brand)]">{detail.campaign_name}</p>

                <div className="mt-4">
                  <CreatorDetailCard creatorId={detail.creator_id} participationId={detail.id} />
                </div>

                <h3 className="mt-6 text-sm font-semibold text-[var(--color-text)]">Admin note</h3>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Internal note about this applicant…"
                />
                <button onClick={saveNote} className="mt-2 self-start rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]">
                  Save note
                </button>

                <div className="mt-6 flex flex-wrap gap-2 border-t border-white/5 pt-4">
                  <button onClick={() => applyStatus(detail.id, "messaged")} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]">Message</button>
                  <button onClick={() => applyStatus(detail.id, "bookmarked")} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]">Bookmark</button>
                  <button onClick={() => applyStatus(detail.id, "accepted")} className="rounded-lg border border-[var(--color-brand)]/50 bg-[var(--color-brand)]/10 px-3 py-1.5 text-sm text-[var(--color-brand)] hover:bg-[var(--color-brand)]/20">Accept</button>
                  <button onClick={() => applyStatus(detail.id, "declined")} className="rounded-lg border border-[var(--color-danger)]/40 px-3 py-1.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10">Decline</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
