"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAdminToken } from "@/lib/auth";
import { listOwed, listPayouts, type PayoutMethod, recordPayout } from "@/lib/admin";
import { isAuthError } from "@/lib/api";
import { fmtMoney } from "@/lib/format";

const METHODS: PayoutMethod[] = ["paypal", "solana", "whop"];
const METHOD_LABEL: Record<string, string> = { paypal: "PayPal", solana: "Solana", whop: "Whop" };

export default function AdminPaymentsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [method, setMethod] = useState<Record<string, PayoutMethod>>({});

  useEffect(() => {
    setHasToken(!!getAdminToken());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !hasToken) router.replace("/admin/login");
  }, [ready, hasToken, router]);

  const enabled = ready && hasToken;
  const owedQ = useQuery({ queryKey: ["payouts-owed"], queryFn: listOwed, enabled, retry: false });
  const histQ = useQuery({ queryKey: ["payouts-history"], queryFn: listPayouts, enabled, retry: false });
  useEffect(() => {
    if (owedQ.isError && isAuthError(owedQ.error)) router.replace("/admin/login");
  }, [owedQ.isError, owedQ.error, router]);

  const payM = useMutation({
    mutationFn: ({ id, m }: { id: string; m: PayoutMethod }) => recordPayout(id, m),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payouts-owed"] });
      qc.invalidateQueries({ queryKey: ["payouts-history"] });
    },
  });

  if (!ready || !hasToken)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );

  const owed = owedQ.data ?? [];
  const history = histQ.data ?? [];
  const totalOwed = owed.reduce((s, r) => s + Number(r.amount_owed), 0);
  const totalPaid = history.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="min-h-[100dvh]">
      <AdminNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Operations Terminal</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Payments</h1>
        <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
          Settle verified creator earnings. Each submission is paid at most once.
        </p>

        {/* summary */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="card-grad rounded-[var(--radius-card)] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Outstanding</p>
            <p className="tabular mt-3 text-3xl font-semibold text-[var(--color-brand-soft)]">{fmtMoney(totalOwed)}</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{owed.length} creators awaiting payout</p>
          </div>
          <div className="card-grad rounded-[var(--radius-card)] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Paid all-time</p>
            <p className="tabular mt-3 text-3xl font-semibold text-[var(--color-text)]">{fmtMoney(totalPaid)}</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{history.length} payouts</p>
          </div>
          <div className="card-grad rounded-[var(--radius-card)] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Methods</p>
            <p className="mt-3 text-lg font-semibold text-[var(--color-text)]">PayPal · Solana · Whop</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Sent out-of-band, logged here</p>
          </div>
        </div>

        {/* outstanding balances */}
        <div id="outstanding" className="card-lumina mt-6 scroll-mt-24 overflow-hidden rounded-[var(--radius-card)]">
          <div className="border-b border-[var(--color-border)] px-6 py-4">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Outstanding balances</h2>
          </div>
          {owedQ.isLoading ? (
            <p className="p-6 text-sm text-[var(--color-text-secondary)]">Loading…</p>
          ) : owed.length === 0 ? (
            <p className="p-10 text-center text-sm text-[var(--color-text-secondary)]">All verified earnings are settled.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                    <th className="px-6 py-3 font-medium">Creator</th>
                    <th className="px-6 py-3 text-right font-medium">Verified clips</th>
                    <th className="px-6 py-3 text-right font-medium">Owed</th>
                    <th className="px-6 py-3 text-right font-medium">Record payout</th>
                  </tr>
                </thead>
                <tbody>
                  {owed.map((r) => (
                    <tr key={r.creator_id} className="border-t border-[var(--color-border)]/40">
                      <td className="px-6 py-4 text-[var(--color-text)]">{r.display_name ?? "Unnamed"}</td>
                      <td className="tabular px-6 py-4 text-right text-[var(--color-text-secondary)]">{r.submission_count}</td>
                      <td className="tabular px-6 py-4 text-right font-medium text-[var(--color-text)]">{fmtMoney(r.amount_owed)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <select
                            value={method[r.creator_id] ?? "paypal"}
                            onChange={(e) => setMethod((m) => ({ ...m, [r.creator_id]: e.target.value as PayoutMethod }))}
                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-text)]"
                          >
                            {METHODS.map((m) => (
                              <option key={m} value={m}>{METHOD_LABEL[m]}</option>
                            ))}
                          </select>
                          <button
                            disabled={payM.isPending}
                            onClick={() => payM.mutate({ id: r.creator_id, m: method[r.creator_id] ?? "paypal" })}
                            className="cursor-pointer rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-[var(--color-on-brand)] hover:bg-emerald-400 disabled:opacity-50"
                          >
                            {payM.isPending ? "Paying…" : "Pay now"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* payout history */}
        <div id="history" className="card-lumina mt-6 scroll-mt-24 overflow-hidden rounded-[var(--radius-card)]">
          <div className="border-b border-[var(--color-border)] px-6 py-4">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Payout history</h2>
          </div>
          {history.length === 0 ? (
            <p className="p-10 text-center text-sm text-[var(--color-text-secondary)]">No payouts recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                    <th className="px-6 py-3 font-medium">Creator</th>
                    <th className="px-6 py-3 font-medium">Method</th>
                    <th className="px-6 py-3 text-right font-medium">Amount</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 text-right font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((p) => (
                    <tr key={p.id} className="border-t border-[var(--color-border)]/40">
                      <td className="px-6 py-4 text-[var(--color-text)]">{p.creator_name ?? "Unnamed"}</td>
                      <td className="px-6 py-4 text-[var(--color-text-secondary)]">{METHOD_LABEL[p.method] ?? p.method}</td>
                      <td className="tabular px-6 py-4 text-right text-[var(--color-text)]">{fmtMoney(p.amount)}</td>
                      <td className="px-6 py-4"><StatusBadge status={p.status} /></td>
                      <td className="px-6 py-4 text-right text-[var(--color-text-muted)]">
                        {new Date(p.paid_at ?? p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
