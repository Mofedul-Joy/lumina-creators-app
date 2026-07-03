"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Pager } from "@/components/admin/Pager";
import { getAdminToken } from "@/lib/auth";
import { fmtMoney } from "@/lib/format";
import { type AdminCampaign, archiveCampaign, listAdminCampaigns, publishCampaign } from "@/lib/admin";

const PAGE_SIZE = 8;

function LineIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
function GridIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /></svg>;
}

export default function AdminCampaignsPage() {
  const qc = useQueryClient();
  const [hasToken, setHasToken] = useState(false);
  const [view, setView] = useState<"line" | "grid">("line");
  const [page, setPage] = useState(1);
  useEffect(() => setHasToken(!!getAdminToken()), []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => listAdminCampaigns(),
    enabled: hasToken,
    retry: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
  const publish = useMutation({ mutationFn: (id: string) => publishCampaign(id), onSuccess: invalidate });
  const archive = useMutation({ mutationFn: (id: string) => archiveCampaign(id), onSuccess: invalidate });

  const all = data ?? [];
  const pageCount = Math.ceil(all.length / PAGE_SIZE);
  const rows = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-[100dvh]">
      <AdminNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">Campaigns</h1>
            <p className="mt-1 text-[var(--color-text-secondary)]">Create, publish, and manage every campaign.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-full bg-[var(--color-surface)] p-1">
              {(["line", "grid"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setView(m)}
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
                  <div className="relative h-32 w-full bg-gradient-to-br from-[var(--color-brand)]/40 to-[var(--color-bg-deep)]">
                    {c.brand_logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.brand_logo_url} alt="" className="h-full w-full object-cover" />
                    ) : null}
                    <span className="absolute right-3 top-3"><StatusBadge status={c.status} /></span>
                  </div>
                  <div className="p-4">
                    <p className="font-medium text-[var(--color-text)]">{c.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{c.brand_name ?? "—"} · {c.mode === "create_new" ? "Original UGC" : "Approved clips"}</p>
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
                    <tr key={c.id} className="bg-[var(--color-bg)] transition hover:bg-[var(--color-surface)]/50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/campaigns/${c.id}`} className="font-medium text-[var(--color-text)] hover:text-[var(--color-brand)]">{c.name}</Link>
                        <p className="text-xs text-[var(--color-text-muted)]">{c.brand_name ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{c.mode === "create_new" ? "Create new" : "Repost"}</td>
                      <td className="tabular px-4 py-3 text-[var(--color-text)]">{fmtMoney(c.cpm_rate)}</td>
                      <td className="tabular px-4 py-3 text-[var(--color-text-secondary)]">{fmtMoney(c.budget)}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-right">
                        {c.status === "draft" ? (
                          <button className="cursor-pointer text-sm font-medium text-[var(--color-brand)] hover:underline" onClick={() => publish.mutate(c.id)}>Publish</button>
                        ) : c.status !== "archived" ? (
                          <button className="cursor-pointer text-sm text-[var(--color-text-muted)] hover:text-[var(--color-danger)]" onClick={() => archive.mutate(c.id)}>Archive</button>
                        ) : (
                          <span className="text-sm text-[var(--color-text-muted)]">—</span>
                        )}
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
