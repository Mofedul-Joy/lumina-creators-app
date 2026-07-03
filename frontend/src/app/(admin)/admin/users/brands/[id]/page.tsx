"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAdminToken } from "@/lib/auth";
import { getBrandDetail, reactivateClient, suspendClient } from "@/lib/admin";
import { isAuthError } from "@/lib/api";
import { fmtMoney } from "@/lib/format";

export default function AdminBrandDetailPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => { setHasToken(!!getAdminToken()); setReady(true); }, []);
  useEffect(() => { if (ready && !hasToken) router.replace("/admin/login"); }, [ready, hasToken, router]);

  const q = useQuery({ queryKey: ["brand", id], queryFn: () => getBrandDetail(id), enabled: ready && hasToken, retry: false });
  useEffect(() => { if (q.isError && isAuthError(q.error)) router.replace("/admin/login"); }, [q.isError, q.error, router]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["brand", id] });
  const approveM = useMutation({ mutationFn: () => reactivateClient(id), onSuccess: refresh });
  const unapproveM = useMutation({ mutationFn: () => suspendClient(id), onSuccess: refresh });

  if (!ready || !hasToken)
    return <main className="flex min-h-[100dvh] items-center justify-center"><p className="text-sm text-[var(--color-text-secondary)]">Loading…</p></main>;

  const b = q.data;
  const busy = approveM.isPending || unapproveM.isPending;

  return (
    <div className="min-h-[100dvh]">
      <AdminNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/admin/users/brands" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">← Brands</Link>
        {!b ? (
          <p className="mt-8 text-sm text-[var(--color-text-secondary)]">Loading brand…</p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">{b.name ?? "Unnamed brand"}</h1>
                <StatusBadge status={b.status === "active" ? "active" : "rejected"} />
              </div>
              {b.status === "active" ? (
                <button disabled={busy} onClick={() => unapproveM.mutate()} className="cursor-pointer rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-red-400 hover:ring-red-500/25 disabled:opacity-50">Unapprove access</button>
              ) : (
                <button disabled={busy} onClick={() => approveM.mutate()} className="cursor-pointer rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-[var(--color-on-brand)] disabled:opacity-50">Approve access</button>
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Info label="Email" value={b.email} />
              <Info label="Status" value={b.status} />
              <Info label="Joined" value={new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />
            </div>

            <div className="card-lumina mt-6 overflow-hidden rounded-[var(--radius-card)]">
              <div className="border-b border-[var(--color-border)] px-6 py-4">
                <h2 className="text-lg font-semibold text-[var(--color-text)]">Campaigns ({b.campaigns.length})</h2>
              </div>
              {b.campaigns.length === 0 ? (
                <p className="p-8 text-center text-sm text-[var(--color-text-secondary)]">No campaigns linked to this brand yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                        <th className="px-6 py-3 font-medium">Campaign</th>
                        <th className="px-6 py-3 text-right font-medium">CPM</th>
                        <th className="px-6 py-3 text-right font-medium">Budget</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.campaigns.map((k) => (
                        <tr key={k.id} className="border-t border-[var(--color-border)]/40">
                          <td className="px-6 py-3"><Link href={`/admin/campaigns/${k.id}`} className="text-[var(--color-text)] hover:text-[var(--color-brand)]">{k.name}</Link></td>
                          <td className="tabular px-6 py-3 text-right text-[var(--color-text-secondary)]">{fmtMoney(k.cpm_rate)}</td>
                          <td className="tabular px-6 py-3 text-right text-[var(--color-text-secondary)]">{fmtMoney(k.budget)}</td>
                          <td className="px-6 py-3"><StatusBadge status={k.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-grad rounded-[var(--radius-card)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 truncate text-[var(--color-text)]">{value}</p>
    </div>
  );
}
