"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { getAdminToken } from "@/lib/auth";
import {
  addWalletFunds,
  downloadPayoutReportsCsv,
  getForecast,
  getLedger,
  getSpendingSummary,
  getWallet,
  listCreators,
  listOwedV2,
  payAll,
  type CreatorRow,
  type ForecastRow,
  type LedgerRow,
  type OwedRowV2,
  type SpendingSummary,
} from "@/lib/admin";
import { getCreatorDetail, isAuthError, type CreatorDetail, retryNonAuth} from "@/lib/api";
import { PayCreatorModal } from "@/components/admin/PayCreatorModal";
import { fmtInt, fmtMoney } from "@/lib/format";

// Rev2 #7: only two visible sections — Awaiting Payments and Paid — plus a
// campaign filter. The Ledger/Creators/Forecast/Agency views are kept in the
// code (unreachable) so nothing is lost; restore them here to bring them back.
const PAGE_TABS = [
  { key: "awaiting", label: "Awaiting Payments" },
  { key: "paid", label: "Paid" },
] as const;
type PageTab = "awaiting" | "paid" | "ledger" | "creators" | "forecast" | "agency";

const LEDGER_BADGE: Record<string, string> = {
  deposit: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  refund: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  withdrawal: "bg-red-500/15 text-red-400 border-red-500/30",
  payout: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  adjustment: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

function KindBadge({ kind }: { kind: string }) {
  const cls = LEDGER_BADGE[kind] ?? "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border-[var(--color-border)]";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {kind}
    </span>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ---- Agency tab: Spending Report (by date range) ---- */
type Preset = "mtd" | "last_month" | "last_3m" | "all" | "custom";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "mtd", label: "Month to Date" },
  { key: "last_month", label: "Last Month" },
  { key: "last_3m", label: "Last 3 Months" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom Range" },
];
// Local date parts (not toISOString, which shifts by timezone).
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function presetRange(p: Preset, from: string, to: string): { from?: string; to?: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (p === "mtd") return { from: isoDay(new Date(y, m, 1)), to: isoDay(now) };
  if (p === "last_month") return { from: isoDay(new Date(y, m - 1, 1)), to: isoDay(new Date(y, m, 0)) };
  if (p === "last_3m") return { from: isoDay(new Date(y, m - 3, now.getDate())), to: isoDay(now) };
  if (p === "custom") return { from: from || undefined, to: to || undefined };
  return {}; // all time
}

function AgencyTab() {
  const [preset, setPreset] = useState<Preset>("mtd");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [summary, setSummary] = useState<SpendingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const range = presetRange(preset, customFrom, customTo);
  const generate = async () => {
    setLoading(true); setErr(""); setSummary(null);
    try { setSummary(await getSpendingSummary(range.from, range.to)); }
    catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  };

  const fieldCls = "min-h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]";

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Transfer Balance — informational for a single-brand workspace */}
      <div className="card-lumina rounded-[var(--radius-card)] p-5">
        <h3 className="text-base font-semibold text-[var(--color-text)]">Transfer Balance</h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Move funds between companies in your agency.</p>
        <div className="mt-6 rounded-[var(--radius-btn)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]">
          This is a single-brand workspace with one shared wallet — inter-company transfers apply to multi-brand agencies. Use <span className="text-[var(--color-text-secondary)]">Wallet → Add Funds</span> to top up.
        </div>
      </div>

      {/* Spending Report */}
      <div className="card-lumina rounded-[var(--radius-card)] p-5">
        <h3 className="text-base font-semibold text-[var(--color-text)]">Spending Report</h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Generate a payout report by date range.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => { setPreset(p.key); setSummary(null); }}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-xs transition ${
                preset === p.key
                  ? "bg-[var(--color-brand)] font-semibold text-[var(--color-on-brand)]"
                  : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={fieldCls} />
            <span className="text-[var(--color-text-muted)]">→</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={fieldCls} />
          </div>
        ) : null}
        <button
          onClick={generate}
          disabled={loading}
          className="mt-4 w-full cursor-pointer rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-[var(--color-on-brand)] transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate Report"}
        </button>
        {err ? <p className="mt-3 text-sm text-[var(--color-danger)]">{err}</p> : null}
        {summary ? (
          <div className="mt-4 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              Total spend{summary.from ? ` · ${summary.from} → ${summary.to}` : " · all time"}
            </p>
            <p className="tabular mt-1 text-2xl font-semibold text-[var(--color-brand-soft)]">{fmtMoney(summary.total)}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{summary.count} payout{summary.count === 1 ? "" : "s"}</p>
            <button
              onClick={() => downloadPayoutReportsCsv(summary.from ?? undefined, summary.to ?? undefined)}
              className="mt-3 cursor-pointer rounded-full border border-[var(--color-border)] px-4 py-1.5 text-sm text-[var(--color-text)] transition hover:border-[var(--color-brand)]"
            >
              Download CSV
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [tab, setTab] = useState<PageTab>("awaiting");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hoverRow, setHoverRow] = useState<string | null>(null);

  const [payMenuOpen, setPayMenuOpen] = useState(false);
  // Row "Pay" opens a details popup (copyable creator payment info + receipt
  // capture) rather than paying blind. Null when closed.
  const [payTarget, setPayTarget] = useState<{ creator: CreatorDetail; owed: number } | null>(null);
  const [payLoadingId, setPayLoadingId] = useState<string | null>(null);

  async function openPay(creatorId: string, owed: number) {
    setPayLoadingId(creatorId);
    try {
      const creator = await getCreatorDetail(getAdminToken() ?? "", creatorId);
      if (creator) setPayTarget({ creator, owed });
    } finally {
      setPayLoadingId(null);
    }
  }
  const [walletOpen, setWalletOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [addFundsForm, setAddFundsForm] = useState({ amount: "", reference: "", note: "" });
  const [showPayAllConfirm, setShowPayAllConfirm] = useState(false);
  const [payAllScope, setPayAllScope] = useState<"all" | "selected">("all");

  useEffect(() => {
    setHasToken(!!getAdminToken());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !hasToken) router.replace("/admin/login");
  }, [ready, hasToken, router]);

  const enabled = ready && hasToken;

  const owedQ = useQuery({ queryKey: ["payouts-owed-v2"], queryFn: listOwedV2, enabled, retry: retryNonAuth });
  const walletQ = useQuery({ queryKey: ["payouts-wallet"], queryFn: getWallet, enabled, retry: retryNonAuth });
  const ledgerQ = useQuery({
    queryKey: ["payouts-ledger"],
    queryFn: () => getLedger(100),
    enabled: enabled && tab === "paid",
    retry: retryNonAuth,
  });
  const forecastQ = useQuery({
    queryKey: ["payouts-forecast"],
    queryFn: getForecast,
    enabled: enabled && tab === "forecast",
    retry: retryNonAuth,
  });
  const creatorsQ = useQuery({
    queryKey: ["payments-creators-tab"],
    queryFn: () => listCreators({}),
    enabled: enabled && tab === "creators",
    retry: retryNonAuth,
  });

  useEffect(() => {
    if (owedQ.isError && isAuthError(owedQ.error)) router.replace("/admin/login");
  }, [owedQ.isError, owedQ.error, router]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["payouts-owed-v2"] });
    qc.invalidateQueries({ queryKey: ["payouts-wallet"] });
    qc.invalidateQueries({ queryKey: ["payouts-ledger"] });
    qc.invalidateQueries({ queryKey: ["payouts-forecast"] });
  };

  const addFundsM = useMutation({
    mutationFn: () =>
      addWalletFunds({
        amount: Number(addFundsForm.amount),
        reference: addFundsForm.reference.trim() || undefined,
        note: addFundsForm.note.trim() || undefined,
      }),
    onSuccess: () => {
      setShowAddFunds(false);
      setAddFundsForm({ amount: "", reference: "", note: "" });
      refresh();
    },
  });

  const payAllM = useMutation({
    mutationFn: () => payAll(payAllScope === "selected" ? Array.from(selected) : undefined),
    onSuccess: () => {
      setShowPayAllConfirm(false);
      setSelected(new Set());
      refresh();
    },
  });

  if (!ready || !hasToken)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );

  const owed = owedQ.data ?? [];
  const wallet = walletQ.data;
  const ledger = ledgerQ.data ?? [];
  const forecast = forecastQ.data ?? [];
  const creators = creatorsQ.data ?? [];

  // Campaign filter (Rev2 #7): options built from the owed rows themselves.
  const campaignOptions = Array.from(
    new Map(
      owed.filter((r) => r.campaign_id).map((r) => [r.campaign_id as string, r.program_name ?? "Campaign"] as const),
    ).entries(),
  ).map(([id, name]) => ({ id, name }));
  const owedView = campaignFilter === "all" ? owed : owed.filter((r) => r.campaign_id === campaignFilter);

  const totalOwed = owed.reduce((s, r) => s + Number(r.amount_owed), 0);
  const availableBalance = wallet ? Number(wallet.available_balance) : 0;
  const pendingBalance = wallet ? Number(wallet.pending_balance) : 0;

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => (prev.size === owedView.length ? new Set() : new Set(owedView.map((r) => r.creator_id))));
  };

  const selectedOwedTotal = owedView.filter((r) => selected.has(r.creator_id)).reduce((s, r) => s + Number(r.amount_owed), 0);

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Payouts</h1>
            <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
              Review performance and pay creators.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={refresh}
              className="cursor-pointer rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
            >
              Refresh
            </button>

            <div className="relative">
              <button
                onClick={() => { setPayMenuOpen((v) => !v); setWalletOpen(false); setReportsOpen(false); }}
                className="cursor-pointer rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
              >
                Pay ▾
              </button>
              {payMenuOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-52 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-xl" onMouseLeave={() => setPayMenuOpen(false)}>
                  <button
                    disabled={owed.length === 0}
                    onClick={() => { setPayAllScope("all"); setShowPayAllConfirm(true); setPayMenuOpen(false); }}
                    className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-2)] disabled:opacity-40"
                  >
                    Pay all owed · {fmtMoney(totalOwed)}
                  </button>
                  <button
                    disabled={selected.size === 0}
                    onClick={() => { setPayAllScope("selected"); setShowPayAllConfirm(true); setPayMenuOpen(false); }}
                    className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-2)] disabled:opacity-40"
                  >
                    Pay selected{selected.size > 0 ? ` (${selected.size})` : ""}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                onClick={() => { setWalletOpen((v) => !v); setPayMenuOpen(false); setReportsOpen(false); }}
                className="cursor-pointer rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
              >
                Wallet {wallet ? `· ${fmtMoney(availableBalance)}` : ""} ▾
              </button>
              {walletOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-xl" onMouseLeave={() => setWalletOpen(false)}>
                  <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                    Available: <span className="text-[var(--color-text)]">{fmtMoney(availableBalance)}</span>
                  </div>
                  <button
                    onClick={() => { setShowAddFunds(true); setWalletOpen(false); }}
                    className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                  >
                    Add Funds
                  </button>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                onClick={() => { setReportsOpen((v) => !v); setPayMenuOpen(false); setWalletOpen(false); }}
                className="cursor-pointer rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
              >
                Reports ▾
              </button>
              {reportsOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-48 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-xl" onMouseLeave={() => setReportsOpen(false)}>
                  <button
                    onClick={() => { downloadPayoutReportsCsv(); setReportsOpen(false); }}
                    className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                  >
                    Download CSV
                  </button>
                </div>
              ) : null}
            </div>

            <button
              onClick={() => { setPayAllScope(selected.size > 0 ? "selected" : "all"); setShowPayAllConfirm(true); }}
              disabled={owed.length === 0}
              className="cursor-pointer rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-[var(--color-on-brand)] transition hover:opacity-90 disabled:opacity-40"
            >
              Pay All
            </button>
          </div>
        </div>

        <AdminTabs />

        {payAllM.isSuccess ? (
          <div className="mt-2 rounded-[var(--radius-btn)] border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/10 px-4 py-3 text-sm text-[var(--color-brand-soft)]">
            Paid {payAllM.data.paid_count} creator{payAllM.data.paid_count === 1 ? "" : "s"} a total of {fmtMoney(payAllM.data.total_amount)}.
          </div>
        ) : payAllM.isError ? (
          <div className="mt-2 rounded-[var(--radius-btn)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
            Pay All failed: {(payAllM.error as Error).message}
          </div>
        ) : null}

        {/* stat tiles */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card-lumina rounded-[var(--radius-card)] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Available Balance</p>
            <p className="tabular mt-3 text-3xl font-semibold text-[var(--color-brand-soft)]">{fmtMoney(availableBalance)}</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">In the system wallet</p>
          </div>
          <div className="card-lumina rounded-[var(--radius-card)] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Pending Balance</p>
            <p className="tabular mt-3 text-3xl font-semibold text-[var(--color-text)]">{fmtMoney(pendingBalance)}</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Reserved, not yet settled</p>
          </div>
          <div className="card-lumina rounded-[var(--radius-card)] p-5">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Total Owed</p>
            <p className="tabular mt-3 text-3xl font-semibold text-[var(--color-text)]">{fmtMoney(totalOwed)}</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{owed.length} creator rows</p>
          </div>
        </div>

        {/* page tabs */}
        <div className="mt-8 flex gap-1 overflow-x-auto border-b border-[var(--color-border)] no-scrollbar">
          {PAGE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 cursor-pointer border-b-2 px-3 py-2.5 text-sm transition ${
                tab === t.key ? "border-[var(--color-brand)] text-[var(--color-text)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "awaiting" ? (
          <div className="mt-4">
            {campaignOptions.length > 0 ? (
              <div className="mb-3 flex items-center gap-2">
                <label htmlFor="pay-campaign" className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Campaign</label>
                <select
                  id="pay-campaign"
                  value={campaignFilter}
                  onChange={(e) => { setCampaignFilter(e.target.value); setSelected(new Set()); }}
                  className="cursor-pointer rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
                >
                  <option value="all">All campaigns</option>
                  {campaignOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {selected.size > 0 ? (
              <div className="mb-3 flex items-center justify-between rounded-[var(--radius-btn)] border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/10 px-4 py-2.5">
                <span className="text-sm text-[var(--color-brand-soft)]">
                  {selected.size} selected · {fmtMoney(selectedOwedTotal)}
                </span>
                <button
                  onClick={() => { setPayAllScope("selected"); setShowPayAllConfirm(true); }}
                  className="cursor-pointer rounded-full bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-[var(--color-on-brand)] hover:bg-emerald-400"
                >
                  Pay Selected
                </button>
              </div>
            ) : null}
            <div className="card-lumina overflow-hidden rounded-[var(--radius-card)]">
              {owedQ.isLoading ? (
                <p className="p-6 text-sm text-[var(--color-text-secondary)]">Loading…</p>
              ) : owedView.length === 0 ? (
                <p className="p-10 text-center text-sm text-[var(--color-text-secondary)]">{campaignFilter === "all" ? "Everyone is paid up." : "No one is owed on this campaign."}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                        <th className="px-4 py-3 font-medium">
                          <input type="checkbox" checked={selected.size === owedView.length && owedView.length > 0} onChange={toggleAll} className="cursor-pointer" />
                        </th>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 text-right font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium">Start Date</th>
                        <th className="px-4 py-3 font-medium">Due Date</th>
                        <th className="px-4 py-3 font-medium">Program</th>
                        <th className="px-4 py-3 text-right font-medium">Unpaid Posts</th>
                        <th className="px-4 py-3 font-medium">Metrics</th>
                        <th className="px-4 py-3 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {owedView.map((r: OwedRowV2) => (
                        <tr key={`${r.creator_id}-${r.campaign_id}`} className="border-t border-[var(--color-border)]/40">
                          <td className="px-4 py-4">
                            <input type="checkbox" checked={selected.has(r.creator_id)} onChange={() => toggleRow(r.creator_id)} className="cursor-pointer" />
                          </td>
                          <td className="px-4 py-4 text-[var(--color-text)]">
                            <div className="flex items-center gap-2">
                              {r.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={r.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                              ) : (
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-xs text-[var(--color-text-muted)]">
                                  {(r.display_name ?? "?").slice(0, 1).toUpperCase()}
                                </span>
                              )}
                              <span>{r.display_name ?? "Unnamed"}</span>
                            </div>
                          </td>
                          <td
                            className="tabular relative px-4 py-4 text-right font-medium text-[var(--color-text)]"
                            onMouseEnter={() => setHoverRow(`${r.creator_id}-${r.campaign_id}`)}
                            onMouseLeave={() => setHoverRow(null)}
                          >
                            {fmtMoney(r.amount_owed)}
                            {hoverRow === `${r.creator_id}-${r.campaign_id}` ? (
                              <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left text-xs shadow-xl">
                                <div className="flex justify-between py-0.5"><span className="text-[var(--color-text-muted)]">Fixed</span><span className="text-[var(--color-text)]">{fmtMoney(r.breakdown.fixed)}</span></div>
                                <div className="flex justify-between py-0.5"><span className="text-[var(--color-text-muted)]">CPM</span><span className="text-[var(--color-text)]">{fmtMoney(r.breakdown.cpm)}</span></div>
                                <div className="flex justify-between py-0.5"><span className="text-[var(--color-text-muted)]">Per-post</span><span className="text-[var(--color-text)]">{fmtMoney(r.breakdown.per_post)}</span></div>
                                <div className="flex justify-between py-0.5"><span className="text-[var(--color-text-muted)]">Milestones</span><span className="text-[var(--color-text)]">{fmtMoney(r.breakdown.milestones)}</span></div>
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 text-[var(--color-text-secondary)]">{fmtDate(r.start_date)}</td>
                          <td className="px-4 py-4 text-[var(--color-text-secondary)]">{fmtDate(r.due_date)}</td>
                          <td className="px-4 py-4 text-[var(--color-text-secondary)]" title={r.program_name ?? undefined}>
                            <span className="block max-w-[160px] truncate">{r.program_name ?? "—"}</span>
                          </td>
                          <td className="tabular px-4 py-4 text-right text-[var(--color-text-secondary)]">{r.unpaid_posts}</td>
                          <td className="px-4 py-4 text-[var(--color-text-secondary)]">{fmtInt(r.total_views)} views</td>
                          <td className="px-4 py-4 text-right">
                            <button
                              onClick={() => openPay(r.creator_id, Number(r.amount_owed))}
                              disabled={payLoadingId === r.creator_id}
                              className="cursor-pointer rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-[var(--color-on-brand)] hover:bg-emerald-400 disabled:opacity-50"
                            >
                              {payLoadingId === r.creator_id ? "…" : "Pay"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : tab === "paid" ? (
          <div className="card-lumina mt-4 overflow-hidden rounded-[var(--radius-card)]">
            {ledgerQ.isLoading ? (
              <p className="p-6 text-sm text-[var(--color-text-secondary)]">Loading…</p>
            ) : ledger.filter((t) => t.kind === "payout").length === 0 ? (
              <p className="p-10 text-center text-sm text-[var(--color-text-secondary)]">No payments made yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 text-right font-medium">Amount</th>
                      <th className="px-6 py-3 font-medium">Reference</th>
                      <th className="px-6 py-3 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.filter((t) => t.kind === "payout").map((t: LedgerRow) => (
                      <tr key={t.id} className="border-t border-[var(--color-border)]/40">
                        <td className="px-6 py-4 text-[var(--color-text-muted)]">
                          {new Date(t.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        </td>
                        <td className="tabular px-6 py-4 text-right font-medium text-[var(--color-text)]">{fmtMoney(t.amount)}</td>
                        <td className="px-6 py-4 text-[var(--color-text-secondary)]">{t.reference ?? "—"}</td>
                        <td className="max-w-[280px] px-6 py-4 text-[var(--color-text-secondary)]">{t.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : tab === "ledger" ? (
          <div className="card-lumina mt-4 overflow-hidden rounded-[var(--radius-card)]">
            {ledgerQ.isLoading ? (
              <p className="p-6 text-sm text-[var(--color-text-secondary)]">Loading…</p>
            ) : ledger.length === 0 ? (
              <p className="p-10 text-center text-sm text-[var(--color-text-secondary)]">No wallet activity yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 font-medium">Kind</th>
                      <th className="px-6 py-3 text-right font-medium">Amount</th>
                      <th className="px-6 py-3 font-medium">Reference</th>
                      <th className="px-6 py-3 font-medium">Note</th>
                      <th className="px-6 py-3 text-right font-medium">Balance After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((t: LedgerRow) => (
                      <tr key={t.id} className="border-t border-[var(--color-border)]/40">
                        <td className="px-6 py-4 text-[var(--color-text-muted)]">
                          {new Date(t.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        </td>
                        <td className="px-6 py-4"><KindBadge kind={t.kind} /></td>
                        <td className="tabular px-6 py-4 text-right text-[var(--color-text)]">{fmtMoney(t.amount)}</td>
                        <td className="px-6 py-4 text-[var(--color-text-secondary)]">{t.reference ?? "—"}</td>
                        <td className="max-w-[220px] px-6 py-4 text-[var(--color-text-secondary)]">{t.note ?? "—"}</td>
                        <td className="tabular px-6 py-4 text-right font-medium text-[var(--color-text)]">{fmtMoney(t.balance_after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : tab === "creators" ? (
          <div className="card-lumina mt-4 overflow-hidden rounded-[var(--radius-card)]">
            {creatorsQ.isLoading ? (
              <p className="p-6 text-sm text-[var(--color-text-secondary)]">Loading…</p>
            ) : creators.length === 0 ? (
              <p className="p-10 text-center text-sm text-[var(--color-text-secondary)]">No creators yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                      <th className="px-6 py-3 font-medium">Creator</th>
                      <th className="px-6 py-3 font-medium">Country</th>
                      <th className="px-6 py-3 text-right font-medium">Followers</th>
                      <th className="px-6 py-3 text-right font-medium">Currently Owed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creators.map((c: CreatorRow) => {
                      const owedForCreator = owed
                        .filter((r) => r.creator_id === c.id)
                        .reduce((s, r) => s + Number(r.amount_owed), 0);
                      return (
                        <tr key={c.id} className="border-t border-[var(--color-border)]/40">
                          <td className="px-6 py-4 text-[var(--color-text)]">{c.display_name ?? c.email}</td>
                          <td className="px-6 py-4 text-[var(--color-text-secondary)]">{c.country ?? "—"}</td>
                          <td className="tabular px-6 py-4 text-right text-[var(--color-text-secondary)]">{fmtInt(c.total_followers)}</td>
                          <td className="tabular px-6 py-4 text-right font-medium text-[var(--color-text)]">{fmtMoney(owedForCreator)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : tab === "forecast" ? (
          <div className="mt-4">
            {forecastQ.isLoading ? (
              <p className="p-6 text-sm text-[var(--color-text-secondary)]">Loading…</p>
            ) : forecast.length === 0 ? (
              <p className="card-lumina rounded-[var(--radius-card)] p-10 text-center text-sm text-[var(--color-text-secondary)]">No active campaigns to forecast.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {forecast.map((f: ForecastRow) => {
                  const pct = f.days_remaining !== null && f.days_remaining !== undefined
                    ? Math.max(0, Math.min(100, 100 - f.days_remaining))
                    : null;
                  return (
                    <div key={f.campaign_id} className="card-lumina rounded-[var(--radius-card)] p-5">
                      <p className="text-sm font-semibold text-[var(--color-text)]">{f.campaign_name}</p>
                      <p className="tabular mt-2 text-2xl font-semibold text-[var(--color-brand-soft)]">{fmtMoney(f.projected_amount)}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">Projected spend</p>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-[var(--color-text-muted)]">Creators</p>
                          <p className="tabular text-[var(--color-text)]">{f.active_creators}</p>
                        </div>
                        <div>
                          <p className="text-[var(--color-text-muted)]">Daily burn</p>
                          <p className="tabular text-[var(--color-text)]">{fmtMoney(f.avg_daily_burn)}</p>
                        </div>
                        <div>
                          <p className="text-[var(--color-text-muted)]">Days left</p>
                          <p className="tabular text-[var(--color-text)]">{f.days_remaining ?? "—"}</p>
                        </div>
                      </div>
                      {pct !== null ? (
                        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                          <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${pct}%` }} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <AgencyTab />
        )}

        {/* Add Funds modal */}
        {showAddFunds ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-[var(--color-text)]">Add Funds</h3>
                <button onClick={() => setShowAddFunds(false)} className="cursor-pointer rounded-full p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" aria-label="Close">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Mock top-up — increments the wallet&apos;s available balance. No real payment rail is used.
              </p>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm text-[var(--color-text)]">Amount ($)</span>
                  <input type="number" min="0" step="0.01" value={addFundsForm.amount}
                    onChange={(e) => setAddFundsForm({ ...addFundsForm, amount: e.target.value })}
                    className="min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-[var(--color-text)]">Reference (optional)</span>
                  <input value={addFundsForm.reference} onChange={(e) => setAddFundsForm({ ...addFundsForm, reference: e.target.value })} placeholder="Bank transfer, invoice #…"
                    className="min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-[var(--color-text)]">Note (optional)</span>
                  <input value={addFundsForm.note} onChange={(e) => setAddFundsForm({ ...addFundsForm, note: e.target.value })} placeholder="Notes for the ledger…"
                    className="min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]" />
                </label>
                {addFundsM.isError ? <p className="text-sm text-[var(--color-danger)]">{(addFundsM.error as Error).message}</p> : null}
                <div className="flex justify-end gap-3 pt-1">
                  <button onClick={() => setShowAddFunds(false)} className="cursor-pointer rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Cancel</button>
                  <button
                    disabled={addFundsM.isPending || !addFundsForm.amount || Number(addFundsForm.amount) <= 0}
                    onClick={() => addFundsM.mutate()}
                    className="cursor-pointer rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-[var(--color-on-brand)] disabled:opacity-50"
                  >
                    {addFundsM.isPending ? "Adding…" : "Add Funds"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Pay All confirmation modal */}
        {showPayAllConfirm ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-semibold text-[var(--color-text)]">
                {payAllScope === "selected" ? "Pay selected creators?" : "Pay all creators?"}
              </h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {payAllScope === "selected"
                  ? `This pays ${selected.size} selected creator${selected.size === 1 ? "" : "s"} a total of ${fmtMoney(selectedOwedTotal)} from the wallet.`
                  : `This pays every creator with an outstanding balance — ${fmtMoney(totalOwed)} across ${owed.length} row${owed.length === 1 ? "" : "s"} — from the wallet.`}
                {" "}Bonus milestones are only awarded once.
              </p>
              {payAllM.isError ? <p className="mt-3 text-sm text-[var(--color-danger)]">{(payAllM.error as Error).message}</p> : null}
              <div className="mt-5 flex justify-end gap-3">
                <button onClick={() => setShowPayAllConfirm(false)} className="cursor-pointer rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Cancel</button>
                <button
                  disabled={payAllM.isPending}
                  onClick={() => payAllM.mutate()}
                  className="cursor-pointer rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-[var(--color-on-brand)] disabled:opacity-50"
                >
                  {payAllM.isPending ? "Paying…" : "Confirm Pay All"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {payTarget ? (
        <PayCreatorModal
          creator={payTarget.creator}
          owed={payTarget.owed}
          onClose={() => { setPayTarget(null); refresh(); }}
        />
      ) : null}
    </div>
  );
}
