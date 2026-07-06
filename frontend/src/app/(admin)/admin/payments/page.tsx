"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAdminToken } from "@/lib/auth";
import { listOwed, listPayouts, listSubmissions, logManualPayment, type PayoutMethod, recordPayout } from "@/lib/admin";
import { isAuthError, listCreators } from "@/lib/api";
import { fmtMoney } from "@/lib/format";

const METHODS: PayoutMethod[] = ["paypal", "solana", "whop"];
const METHOD_LABEL: Record<string, string> = { paypal: "PayPal", solana: "Solana", whop: "Whop" };
const PAY_TABS = [
  { key: "to_be_paid", label: "To be paid" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
] as const;
type PayTab = (typeof PAY_TABS)[number]["key"];

export default function AdminPaymentsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [method, setMethod] = useState<Record<string, PayoutMethod>>({});
  const [tab, setTab] = useState<PayTab>("to_be_paid");

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
  const rejectedQ = useQuery({
    queryKey: ["submissions-rejected"],
    queryFn: () => listSubmissions({ status: "rejected" }),
    enabled: enabled && tab === "rejected",
    retry: false,
  });
  useEffect(() => {
    if (owedQ.isError && isAuthError(owedQ.error)) router.replace("/admin/login");
  }, [owedQ.isError, owedQ.error, router]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["payouts-owed"] });
    qc.invalidateQueries({ queryKey: ["payouts-history"] });
  };
  const payM = useMutation({
    mutationFn: ({ id, m }: { id: string; m: PayoutMethod }) => recordPayout(id, m),
    onSuccess: refresh,
  });

  // Add Payment (Clippers receipt flow): money moved elsewhere, log it here
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ creator_id: "", amount: "", method: "paypal" as PayoutMethod, reference: "" });
  const [addErr, setAddErr] = useState("");
  const creatorsQ = useQuery({
    queryKey: ["payments-creators"],
    queryFn: () => listCreators(getAdminToken() ?? "", { limit: 500 }),
    enabled: enabled && showAdd,
    retry: false,
  });
  const addM = useMutation({
    mutationFn: () => logManualPayment({
      creator_id: addForm.creator_id,
      amount: Number(addForm.amount),
      method: addForm.method,
      reference: addForm.reference.trim() || undefined,
    }),
    onSuccess: () => {
      setShowAdd(false);
      setAddForm({ creator_id: "", amount: "", method: "paypal", reference: "" });
      setAddErr("");
      refresh();
    },
    onError: (e) => setAddErr((e as Error).message),
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
      <AdminShell />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Payments</h1>
            <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
              Settle verified creator earnings. Each submission is paid at most once.
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="shrink-0 cursor-pointer text-sm text-[var(--color-text-secondary)] underline decoration-dotted underline-offset-4 transition hover:text-[var(--color-text)]"
            title="Log a payment made outside the app. A manual bookkeeping entry, separate from the Pay now flow"
          >
            Log a manual payment
          </button>
        </div>
        <AdminTabs />

        {/* pay-now result — previously the click gave no feedback at all, so a
            failed payout looked like "nothing happened" */}
        {payM.isSuccess ? (
          <div className="mt-6 rounded-[var(--radius-btn)] border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/10 px-4 py-3 text-sm text-[var(--color-brand-soft)]">
            Recorded a {fmtMoney(payM.data.amount)} payout{payM.data.creator_name ? ` to ${payM.data.creator_name}` : ""}. It&apos;s now under the Paid tab.
          </div>
        ) : payM.isError ? (
          <div className="mt-6 rounded-[var(--radius-btn)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
            Couldn&apos;t record the payout: {(payM.error as Error).message}
          </div>
        ) : null}

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

        {/* the three tabs ARE the organizing axis — no mixed tables, columns
            change per tab so there's never a dead/empty column */}
        <div className="mt-8 flex gap-1 border-b border-[var(--color-border)]">
          {PAY_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`cursor-pointer border-b-2 px-3 py-2.5 text-sm transition ${
                tab === t.key ? "border-[var(--color-brand)] text-[var(--color-text)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
            >
              {t.label}
              {t.key === "to_be_paid" ? ` (${owed.length})` : t.key === "rejected" ? (rejectedQ.data ? ` (${rejectedQ.data.length})` : "") : ""}
            </button>
          ))}
        </div>

        {tab === "to_be_paid" ? (
          <div className="card-lumina mt-4 overflow-hidden rounded-[var(--radius-card)]">
            {owedQ.isLoading ? (
              <p className="p-6 text-sm text-[var(--color-text-secondary)]">Loading…</p>
            ) : owed.length === 0 ? (
              <p className="p-10 text-center text-sm text-[var(--color-text-secondary)]">All verified earnings are settled.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                      <th className="px-6 py-3 font-medium">Creator</th>
                      <th className="px-6 py-3 font-medium">Pay to</th>
                      <th className="px-6 py-3 text-right font-medium">Verified clips</th>
                      <th className="px-6 py-3 text-right font-medium">Owed</th>
                      <th className="px-6 py-3 text-right font-medium">Record payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {owed.map((r) => (
                      <tr key={r.creator_id} className="border-t border-[var(--color-border)]/40">
                        <td className="px-6 py-4 text-[var(--color-text)]">{r.display_name ?? "Unnamed"}</td>
                        <td className="px-6 py-4 text-[var(--color-text-secondary)]">
                          {r.payout_address ? (
                            <>
                              <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{METHOD_LABEL[r.payout_method ?? ""] ?? "-"}</span>
                              <span className="block max-w-[220px] truncate text-xs">{r.payout_address}</span>
                            </>
                          ) : (
                            <span className="text-xs text-[var(--color-text-muted)]">No payout details on file</span>
                          )}
                        </td>
                        <td className="tabular px-6 py-4 text-right text-[var(--color-text-secondary)]">{r.submission_count}</td>
                        <td className="tabular px-6 py-4 text-right font-medium text-[var(--color-text)]">{fmtMoney(r.amount_owed)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={method[r.creator_id] ?? (r.payout_method as PayoutMethod) ?? "paypal"}
                              onChange={(e) => setMethod((m) => ({ ...m, [r.creator_id]: e.target.value as PayoutMethod }))}
                              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs text-[var(--color-text)]"
                            >
                              {METHODS.map((m) => (
                                <option key={m} value={m}>{METHOD_LABEL[m]}</option>
                              ))}
                            </select>
                            <button
                              disabled={payM.isPending}
                              onClick={() => payM.mutate({ id: r.creator_id, m: method[r.creator_id] ?? (r.payout_method as PayoutMethod) ?? "paypal" })}
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
        ) : tab === "paid" ? (
          <div className="card-lumina mt-4 overflow-hidden rounded-[var(--radius-card)]">
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
                        <td className="px-6 py-4 text-[var(--color-text-secondary)]">
                          {METHOD_LABEL[p.method] ?? p.method}
                          {p.reference ? <span className="block text-xs text-[var(--color-text-muted)]">ref: {p.reference}</span> : null}
                        </td>
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
        ) : (
          <div className="card-lumina mt-4 overflow-hidden rounded-[var(--radius-card)]">
            {rejectedQ.isLoading ? (
              <p className="p-6 text-sm text-[var(--color-text-secondary)]">Loading…</p>
            ) : (rejectedQ.data ?? []).length === 0 ? (
              <p className="p-10 text-center text-sm text-[var(--color-text-secondary)]">No rejected submissions.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                      <th className="px-6 py-3 font-medium">Creator</th>
                      <th className="px-6 py-3 font-medium">Campaign</th>
                      <th className="px-6 py-3 font-medium">Reason</th>
                      <th className="px-6 py-3 text-right font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rejectedQ.data ?? []).map((s) => (
                      <tr key={s.id} className="border-t border-[var(--color-border)]/40">
                        <td className="px-6 py-4 text-[var(--color-text)]">{s.creator_name ?? "Unnamed"}</td>
                        <td className="px-6 py-4 text-[var(--color-text-secondary)]">{s.campaign_name}</td>
                        <td className="max-w-[280px] px-6 py-4 text-[var(--color-text-secondary)]">{s.verification_note ?? "-"}</td>
                        <td className="px-6 py-4 text-right text-[var(--color-text-muted)]">
                          {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Add Payment modal — a receipt for money sent outside the app */}
        {showAdd ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAdd(false)}>
            <div className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-[var(--color-text)]">Add payment</h3>
                <button onClick={() => setShowAdd(false)} className="cursor-pointer rounded-full p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" aria-label="Close">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Log a payment you made outside the app. This only creates a receipt.</p>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm text-[var(--color-text)]">Creator</span>
                  <select value={addForm.creator_id} onChange={(e) => setAddForm({ ...addForm, creator_id: e.target.value })}
                    className="min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]">
                    <option value="">Select a creator…</option>
                    {(creatorsQ.data ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.display_name ?? c.email}</option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-[var(--color-text)]">Amount ($)</span>
                    <input type="number" min="0" step="0.01" value={addForm.amount} onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
                      className="min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-[var(--color-text)]">Method</span>
                    <select value={addForm.method} onChange={(e) => setAddForm({ ...addForm, method: e.target.value as PayoutMethod })}
                      className="min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]">
                      {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-[var(--color-text)]">Reference (optional)</span>
                  <input value={addForm.reference} onChange={(e) => setAddForm({ ...addForm, reference: e.target.value })} placeholder="Transaction ID, note…"
                    className="min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]" />
                </label>
                {addErr ? <p className="text-sm text-[var(--color-danger)]">{addErr}</p> : null}
                <div className="flex justify-end gap-3 pt-1">
                  <button onClick={() => setShowAdd(false)} className="cursor-pointer rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Cancel</button>
                  <button
                    disabled={addM.isPending || !addForm.creator_id || !addForm.amount || Number(addForm.amount) <= 0}
                    onClick={() => { setAddErr(""); addM.mutate(); }}
                    className="cursor-pointer rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-[var(--color-on-brand)] disabled:opacity-50"
                  >
                    {addM.isPending ? "Logging…" : "Log payment"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
