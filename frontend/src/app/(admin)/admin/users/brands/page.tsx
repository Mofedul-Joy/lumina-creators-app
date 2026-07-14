"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAdminToken } from "@/lib/auth";
import { listAdminClients, reactivateClient, suspendClient } from "@/lib/admin";
import { isAuthError, retryNonAuth} from "@/lib/api";

export default function AdminBrandsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => { setHasToken(!!getAdminToken()); setReady(true); }, []);
  useEffect(() => { if (ready && !hasToken) router.replace("/admin/login"); }, [ready, hasToken, router]);

  const q = useQuery({ queryKey: ["admin-clients"], queryFn: listAdminClients, enabled: ready && hasToken, retry: retryNonAuth });
  useEffect(() => { if (q.isError && isAuthError(q.error)) router.replace("/admin/login"); }, [q.isError, q.error, router]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-clients"] });
  const approveM = useMutation({ mutationFn: reactivateClient, onSuccess: refresh });
  const unapproveM = useMutation({ mutationFn: suspendClient, onSuccess: refresh });

  const rows = useMemo(() => {
    const t = search.trim().toLowerCase();
    const all = q.data ?? [];
    return t ? all.filter((c) => (c.name ?? "").toLowerCase().includes(t) || c.email.toLowerCase().includes(t)) : all;
  }, [q.data, search]);

  if (!ready || !hasToken)
    return <main className="flex min-h-[100dvh] items-center justify-center"><p className="text-sm text-[var(--color-text-secondary)]">Loading…</p></main>;

  const busy = approveM.isPending || unapproveM.isPending;

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/admin/users" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">← Users</Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Brand accounts</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">Search brands, review their campaigns, and approve access.</p>
        <AdminTabs />

        <div className="mt-6 max-w-md">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brands by name or email…"
            className="min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.isLoading ? (
            <p className="text-sm text-[var(--color-text-secondary)]">Loading brands…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No brands match.</p>
          ) : (
            rows.map((c) => (
              <div key={c.id} className="card-grad rounded-[var(--radius-card)] p-4">
                <Link href={`/admin/users/brands/${c.id}`} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--color-text)]">{c.name ?? "Unnamed brand"}</p>
                      <p className="truncate text-sm text-[var(--color-text-secondary)]">{c.email}</p>
                    </div>
                    <StatusBadge status={c.status === "active" ? "active" : "rejected"} />
                  </div>
                </Link>
                <div className="mt-3 flex items-center justify-between">
                  <Link href={`/admin/users/brands/${c.id}`} className="text-xs font-medium text-[var(--color-brand)] hover:underline">View details →</Link>
                  {c.status === "active" ? (
                    <button disabled={busy} onClick={() => unapproveM.mutate(c.id)} className="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-red-400 hover:ring-red-500/25 disabled:opacity-50">Unapprove</button>
                  ) : (
                    <button disabled={busy} onClick={() => approveM.mutate(c.id)} className="cursor-pointer rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-50">Approve</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
