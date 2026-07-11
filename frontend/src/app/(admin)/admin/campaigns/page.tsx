"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Pager } from "@/components/admin/Pager";
import { getAdminToken } from "@/lib/auth";
import { campaignImage } from "@/lib/campaignTheme";
import { fmtMoney } from "@/lib/format";
import { archiveCampaign, closeCampaign, listAdminCampaigns, publishCampaign, reopenCampaign } from "@/lib/admin";

const PAGE_SIZE = 8;
const VIEW_KEY = "admin-campaigns-view";

// small action icons for the campaigns table
const iconBtn = "grid h-8 w-8 cursor-pointer place-items-center rounded-md text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] transition";
function PencilIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function RocketIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2m4-4 6-6a4 4 0 0 0-6-6l-6 6 6 6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function CloseIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>; }
function ArchiveIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="2" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>; }
function ReopenIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

function LineIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
function GridIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /></svg>;
}

export default function AdminCampaignsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [hasToken, setHasToken] = useState(false);
  // Grid is the default view; a manual switch to the line view is remembered.
  const [view, setView] = useState<"line" | "grid">("grid");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");
  useEffect(() => setHasToken(!!getAdminToken()), []);
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "line" || saved === "grid") setView(saved);
  }, []);

  function chooseView(v: "line" | "grid") {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => listAdminCampaigns(),
    enabled: hasToken,
    retry: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
  const publish = useMutation({ mutationFn: (id: string) => publishCampaign(id), onSuccess: invalidate });
  const archive = useMutation({ mutationFn: (id: string) => archiveCampaign(id), onSuccess: invalidate });
  const close = useMutation({ mutationFn: (id: string) => closeCampaign(id), onSuccess: invalidate });
  const reopen = useMutation({ mutationFn: (id: string) => reopenCampaign(id), onSuccess: invalidate });

  // Bill's campaign states: Live / Draft / Closed / Archived (paused counts as closed)
  const everything = data ?? [];
  const matchesStatus = (s: string) =>
    statusFilter === "all" ? true
    : statusFilter === "live" ? s === "active"
    : statusFilter === "closed" ? s === "completed" || s === "paused"
    : s === statusFilter;
  const all = everything.filter((c) =>
    matchesStatus(c.status) &&
    (!q.trim() || `${c.name} ${c.brand_name ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())),
  );
  const counts = {
    all: everything.length,
    live: everything.filter((c) => c.status === "active").length,
    draft: everything.filter((c) => c.status === "draft").length,
    closed: everything.filter((c) => c.status === "completed" || c.status === "paused").length,
    archived: everything.filter((c) => c.status === "archived").length,
  };
  const pageCount = Math.ceil(all.length / PAGE_SIZE);
  const rows = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">Campaigns</h1>
            <p className="mt-1 text-[var(--color-text-secondary)]">Create, publish, and manage every campaign.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-full bg-[var(--color-surface)] p-1">
              {(["line", "grid"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => chooseView(m)}
                  aria-label={`${m} view`}
                  className={`grid h-8 w-8 cursor-pointer place-items-center rounded-full transition ${
                    view === m ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {m === "line" ? <LineIcon /> : <GridIcon />}
                </button>
              ))}
            </div>
            <Link
              href="/admin/campaigns/new"
              className="inline-flex min-h-11 items-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
            >
              New campaign
            </Link>
          </div>
        </div>
        <AdminTabs />

        {/* status filters + search — the Clippers campaign states */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {([["all", "All"], ["live", "Live"], ["draft", "Draft"], ["closed", "Closed"], ["archived", "Archived"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setStatusFilter(key); setPage(1); }}
                className={`cursor-pointer rounded-full px-4 py-1.5 text-sm transition ${
                  statusFilter === key
                    ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]"
                    : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
              >
                {label}
                <span className="tabular ml-1.5 opacity-70">{counts[key]}</span>
              </button>
            ))}
          </div>
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search campaigns…"
            className="min-h-9 min-w-[220px] flex-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)] sm:max-w-xs"
          />
        </div>

        {!hasToken ? (
          <Notice>Sign in as an admin to manage campaigns. <Link href="/admin/login" className="text-[var(--color-brand)] underline">Admin sign in</Link></Notice>
        ) : isLoading ? (
          <p className="text-[var(--color-text-muted)]">Loading…</p>
        ) : isError ? (
          <Notice>{(error as Error).message}</Notice>
        ) : all.length === 0 ? (
          <Notice>No campaigns yet. Create your first one.</Notice>
        ) : view === "grid" ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((c) => (
                <Link key={c.id} href={`/admin/campaigns/${c.id}`} className="group overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] transition hover:ring-1 hover:ring-[var(--color-brand)]/40">
                  <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-[var(--color-brand)]/40 to-[var(--color-bg-deep)]">
                    {/* Uploaded banner, else a niche-matched stock photo — same
                        resolver the creator-facing cards use, so a campaign
                        never renders as an empty green rectangle. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={campaignImage(c)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                    {/* scrim keeps the status pill legible on a bright photo */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--color-bg-deep)]/85 via-[var(--color-bg-deep)]/20 to-transparent" />
                    <span className="absolute right-3 top-3"><StatusBadge status={c.status} /></span>
                  </div>
                  <div className="p-4">
                    <p className="font-medium text-[var(--color-text)]">{c.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{c.brand_name ?? "-"} · {c.mode === "create_new" ? "Original UGC" : "Approved clips"}</p>
                    <div className="mt-3 flex justify-between text-sm">
                      <span className="tabular text-[var(--color-brand-soft)]">{fmtMoney(c.cpm_rate)} CPM</span>
                      <span className="tabular text-[var(--color-text-secondary)]">{fmtMoney(c.budget)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <Pager page={page} pageCount={pageCount} onPage={setPage} total={all.length} />
          </>
        ) : (
          <>
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Campaign</th>
                    <th className="px-4 py-3 font-medium">Mode</th>
                    <th className="px-4 py-3 font-medium">CPM</th>
                    <th className="px-4 py-3 font-medium">Budget</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {rows.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/admin/campaigns/${c.id}`)}
                      className="cursor-pointer bg-[var(--color-bg)] transition hover:bg-[var(--color-surface)]/50"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--color-text)]">{c.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{c.brand_name ?? "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{c.mode === "create_new" ? "Create new" : "Repost"}</td>
                      <td className="tabular px-4 py-3 text-[var(--color-text)]">{fmtMoney(c.cpm_rate)}</td>
                      <td className="tabular px-4 py-3 text-[var(--color-text-secondary)]">{fmtMoney(c.budget)}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/admin/campaigns/${c.id}`} title="Edit" className={`${iconBtn} hover:text-[var(--color-text)]`}><PencilIcon /></Link>
                          {c.status === "draft" ? (
                            <button title="Publish" className={`${iconBtn} text-emerald-400 ring-emerald-500/25 hover:bg-emerald-500/15`} onClick={() => publish.mutate(c.id)}><RocketIcon /></button>
                          ) : null}
                          {c.status === "active" ? (
                            <button title="Close" className={`${iconBtn} hover:text-amber-400 hover:ring-amber-500/25`} onClick={() => close.mutate(c.id)}><CloseIcon /></button>
                          ) : null}
                          {c.status === "completed" || c.status === "paused" ? (
                            <button title="Reopen" className={`${iconBtn} text-emerald-400 ring-emerald-500/25 hover:bg-emerald-500/15`} onClick={() => reopen.mutate(c.id)}><ReopenIcon /></button>
                          ) : null}
                          {c.status !== "archived" ? (
                            <button title="Archive" className={`${iconBtn} hover:text-[var(--color-danger)]`} onClick={() => archive.mutate(c.id)}><ArchiveIcon /></button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} pageCount={pageCount} onPage={setPage} total={all.length} />
          </>
        )}
      </main>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center text-[var(--color-text-secondary)]">
      {children}
    </div>
  );
}
