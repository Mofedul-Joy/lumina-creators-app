"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { getAdminToken } from "@/lib/auth";
import { getAdminStats, getAdminAnalytics } from "@/lib/admin";
import { isAuthError, retryNonAuth} from "@/lib/api";
import { fmtInt, fmtMoney } from "@/lib/format";

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="card-grad rounded-[var(--radius-card)] p-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
      <p
        className={`tabular mt-3 text-3xl font-semibold ${
          accent ? "text-[var(--color-brand-soft)]" : "text-[var(--color-text)]"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{hint}</p> : null}
    </div>
  );
}

function fmtCompact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}

/** Polished SVG area chart for daily views — gridlines, value axis, smooth line
 *  + gradient fill, and hover points. Scales to the card width (uniform aspect). */
function ViewsAreaChart({ daily }: { daily: { date: string; views: number }[] }) {
  const W = 640, H = 220, padL = 46, padR = 14, padT = 14, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = daily.length;
  const max = Math.max(1, ...daily.map((d) => d.views));
  const x = (i: number) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => padT + ih - (v / max) * ih;
  const pts = daily.map((d, i) => [x(i), y(d.views)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = pts.length
    ? `${line} L ${x(n - 1).toFixed(1)} ${(padT + ih).toFixed(1)} L ${x(0).toFixed(1)} ${(padT + ih).toFixed(1)} Z`
    : "";
  const grids = [0, 0.25, 0.5, 0.75, 1];
  const xticks = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-auto w-full" role="img" aria-label="Views tracked over time">
      <defs>
        <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {grids.map((g) => {
        const gy = padT + ih - g * ih;
        return (
          <g key={g}>
            <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke="var(--color-border)" strokeOpacity="0.45" strokeWidth="1" />
            <text x={padL - 8} y={gy + 3.5} textAnchor="end" fontSize="10.5" fill="var(--color-text-muted)">{fmtCompact(g * max)}</text>
          </g>
        );
      })}
      {area ? <path d={area} fill="url(#viewsFill)" /> : null}
      {line ? <path d={line} fill="none" stroke="var(--color-brand)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" /> : null}
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2.75" fill="var(--color-bg-deep)" stroke="var(--color-brand)" strokeWidth="1.75">
          <title>{`${daily[i].date}: ${fmtCompact(daily[i].views)} views`}</title>
        </circle>
      ))}
      {xticks.map((i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="var(--color-text-muted)">{daily[i]?.date.slice(5)}</text>
      ))}
    </svg>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => {
    setHasToken(!!getAdminToken());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !hasToken) router.replace("/admin/login");
  }, [ready, hasToken, router]);

  const q = useQuery({
    queryKey: ["admin-stats"],
    queryFn: getAdminStats,
    enabled: ready && hasToken,
    retry: retryNonAuth,
  });
  const analyticsQ = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: getAdminAnalytics,
    enabled: ready && hasToken,
    retry: retryNonAuth,
  });
  useEffect(() => {
    if (q.isError && isAuthError(q.error)) router.replace("/admin/login");
  }, [q.isError, q.error, router]);

  // Don't render dashboard data until we've confirmed a token — prevents a
  // flash of cached stats after sign-out before the redirect fires.
  if (!ready || !hasToken)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );

  const s = q.data;
  const a = analyticsQ.data;

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-4xl font-semibold tracking-tight text-[var(--color-text)]">
          Welcome back
        </h1>
        <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
          Monitor campaigns, track submissions, and manage your creator network.
        </p>

        {/* quick actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/admin/campaigns/new"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] shadow-[0_0_20px_-4px_rgba(34,197,94,0.7)] transition hover:bg-[var(--color-brand-hover)]"
          >
            New campaign
          </Link>
          <Link
            href="/admin/creators"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--color-border)] px-5 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-text-muted)]"
          >
            Browse creators
          </Link>
        </div>
        <AdminTabs />

        {/* stat cards — Bill: "Active campaigns, creators, submissions, that's enough" */}
        {q.isError && !isAuthError(q.error) ? (
          <p className="mt-8 text-sm text-[var(--color-danger)]">{(q.error as Error).message}</p>
        ) : null}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <StatCard
            label="Active campaigns"
            value={s ? fmtInt(s.active_campaigns) : "-"}
            hint={s ? `${fmtInt(s.total_campaigns)} total` : undefined}
            accent
          />
          <StatCard
            label="Creators"
            value={s ? fmtInt(s.total_creators) : "-"}
            hint={s ? `${fmtInt(s.completed_creators)} active` : undefined}
          />
          <StatCard
            label="Submissions"
            value={s ? fmtInt(s.total_submissions) : "-"}
            hint={s ? `${fmtInt(s.total_views)} views tracked` : undefined}
          />
        </div>

        {/* second KPI row */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          <StatCard label="Views tracked" value={s ? fmtInt(s.total_views) : "-"} accent />
          <StatCard label="Total spend" value={a ? fmtMoney(a.kpis.total_spend) : "-"} hint={a ? `${fmtMoney(a.kpis.avg_cpm)} avg CPM` : undefined} />
          <StatCard label="Verified posts" value={a ? fmtInt(a.kpis.verified_submissions) : "-"} hint={a ? `${a.kpis.engagement_rate}% engagement` : undefined} />
        </div>

        {/* Bill: dashboard = high-level summary (cards + graph + table), NOT a
            duplicate of the Submissions page. */}
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {/* views over the last N days */}
          <div className="card-grad rounded-[var(--radius-card)] p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text)]">Views tracked</h2>
                {a ? (
                  <p className="tabular mt-1 text-2xl font-semibold text-[var(--color-brand-soft)]">
                    {fmtInt(a.daily.reduce((s, d) => s + d.views, 0))}
                  </p>
                ) : null}
              </div>
              <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-xs text-[var(--color-text-muted)]">last {a ? a.daily.length : 0} days</span>
            </div>
            {a ? <ViewsAreaChart daily={a.daily} /> : <p className="mt-6 text-sm text-[var(--color-text-muted)]">Loading…</p>}
          </div>

          {/* top campaigns table */}
          <div className="card-grad overflow-hidden rounded-[var(--radius-card)]">
            <div className="flex items-center justify-between p-5 pb-3">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Top campaigns</h2>
              <Link href="/admin/campaigns" className="text-xs font-medium text-[var(--color-brand)] hover:underline">All campaigns →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[380px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                    <th className="px-5 py-2 font-medium">Campaign</th>
                    <th className="px-5 py-2 text-right font-medium">Views</th>
                    <th className="px-5 py-2 text-right font-medium">Posts</th>
                    <th className="px-5 py-2 text-right font-medium">Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {(a?.top_campaigns ?? []).slice(0, 6).map((c) => (
                    <tr key={c.id} className="border-t border-[var(--color-border)]/40">
                      <td className="px-5 py-3 text-[var(--color-text)]"><span className="block max-w-[160px] truncate">{c.name}</span></td>
                      <td className="tabular px-5 py-3 text-right text-[var(--color-text-secondary)]">{fmtInt(c.views)}</td>
                      <td className="tabular px-5 py-3 text-right text-[var(--color-text-secondary)]">{fmtInt(c.submissions)}</td>
                      <td className="tabular px-5 py-3 text-right text-[var(--color-text)]">{fmtMoney(c.spend)}</td>
                    </tr>
                  ))}
                  {a && a.top_campaigns.length === 0 ? (
                    <tr><td colSpan={4} className="px-5 py-6 text-center text-sm text-[var(--color-text-muted)]">No campaign activity yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
