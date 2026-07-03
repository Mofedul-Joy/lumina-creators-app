"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAdminToken } from "@/lib/auth";
import { getUsers, reactivateClient, suspendClient } from "@/lib/admin";
import { isAuthError, listCreators } from "@/lib/api";
import { fmtInt } from "@/lib/format";

function StatTile({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const body = (
    <div className="card-grad rounded-[var(--radius-card)] p-5 transition hover:ring-1 hover:ring-[var(--color-brand)]/30">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
      <p className="tabular mt-3 text-3xl font-semibold text-[var(--color-text)]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => {
    setHasToken(!!getAdminToken());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !hasToken) router.replace("/admin/login");
  }, [ready, hasToken, router]);

  const q = useQuery({ queryKey: ["users"], queryFn: getUsers, enabled: ready && hasToken, retry: false });
  const creatorsQ = useQuery({
    queryKey: ["users-creators-preview"],
    queryFn: () => listCreators(getAdminToken() ?? "", { limit: 6 }),
    enabled: ready && hasToken,
    retry: false,
  });
  useEffect(() => {
    if (q.isError && isAuthError(q.error)) router.replace("/admin/login");
  }, [q.isError, q.error, router]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["users"] });
  const suspendM = useMutation({ mutationFn: suspendClient, onSuccess: refresh });
  const reactivateM = useMutation({ mutationFn: reactivateClient, onSuccess: refresh });

  if (!ready || !hasToken)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );

  const u = q.data;
  const busy = suspendM.isPending || reactivateM.isPending;

  return (
    <div className="min-h-[100dvh]">
      <AdminNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Operations Terminal</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Users</h1>
        <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
          Lumina staff, brand accounts, and the creator network.
        </p>

        {!u ? (
          <p className="mt-10 text-sm text-[var(--color-text-secondary)]">Loading…</p>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-3 gap-4">
              <StatTile label="Staff" value={fmtInt(u.admins.length)} hint="Admin accounts" />
              <StatTile label="Brands" value={fmtInt(u.clients.length)} hint="Client accounts" />
              <StatTile label="Creators" value={fmtInt(u.creator_count)} hint={`${u.creator_active} active — view all →`} href="/admin/creators" />
            </div>

            {/* staff */}
            <div className="card-lumina mt-6 overflow-hidden rounded-[var(--radius-card)]">
              <div className="border-b border-[var(--color-border)] px-6 py-4">
                <h2 className="text-lg font-semibold text-[var(--color-text)]">Staff (admins)</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                      <th className="px-6 py-3 font-medium">Email</th>
                      <th className="px-6 py-3 font-medium">Role</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.admins.map((a) => (
                      <tr key={a.id} className="border-t border-[var(--color-border)]/40">
                        <td className="px-6 py-4 text-[var(--color-text)]">{a.email}</td>
                        <td className="px-6 py-4 capitalize text-[var(--color-text-secondary)]">{a.role}</td>
                        <td className="px-6 py-4"><StatusBadge status={a.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* clients */}
            <div className="card-lumina mt-6 overflow-hidden rounded-[var(--radius-card)]">
              <div className="border-b border-[var(--color-border)] px-6 py-4">
                <h2 className="text-lg font-semibold text-[var(--color-text)]">Brand accounts (clients)</h2>
              </div>
              {u.clients.length === 0 ? (
                <p className="p-10 text-center text-sm text-[var(--color-text-secondary)]">No brand accounts yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                        <th className="px-6 py-3 font-medium">Brand</th>
                        <th className="px-6 py-3 font-medium">Email</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 text-right font-medium">Access</th>
                      </tr>
                    </thead>
                    <tbody>
                      {u.clients.map((c) => (
                        <tr key={c.id} className="border-t border-[var(--color-border)]/40">
                          <td className="px-6 py-4 text-[var(--color-text)]">{c.name ?? "—"}</td>
                          <td className="px-6 py-4 text-[var(--color-text-secondary)]">{c.email}</td>
                          <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                          <td className="px-6 py-4 text-right">
                            {c.status === "active" ? (
                              <button
                                disabled={busy}
                                onClick={() => suspendM.mutate(c.id)}
                                className="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-red-400 hover:ring-red-500/25 disabled:opacity-50"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                disabled={busy}
                                onClick={() => reactivateM.mutate(c.id)}
                                className="cursor-pointer rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-50"
                              >
                                Reactivate
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* creators — managed on the Creators page */}
            <div className="card-lumina mt-6 overflow-hidden rounded-[var(--radius-card)]">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
                <h2 className="text-lg font-semibold text-[var(--color-text)]">Creators</h2>
                <Link href="/admin/creators" className="text-sm font-medium text-[var(--color-brand)] hover:underline">View all {u.creator_count} →</Link>
              </div>
              {(creatorsQ.data ?? []).length === 0 ? (
                <p className="p-8 text-center text-sm text-[var(--color-text-secondary)]">No creators yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                  {(creatorsQ.data ?? []).map((c) => (
                    <Link key={c.id} href={`/admin/creators/${c.id}`} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition hover:ring-1 hover:ring-[var(--color-brand)]/40">
                      <p className="truncate text-sm font-medium text-[var(--color-text)]">{c.display_name ?? "Unnamed"}</p>
                      <p className="truncate text-xs text-[var(--color-text-muted)]">{c.email}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
