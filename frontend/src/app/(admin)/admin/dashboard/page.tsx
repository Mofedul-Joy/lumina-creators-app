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
  const maxViews = a ? Math.max(1, ...a.daily.map((d) => d.views)) : 1;

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
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Views tracked</h2>
              <span className="text-xs text-[var(--color-text-muted)]">last {a ? a.daily.length : 0} days</span>
            </div>
            {a ? (
              <div className="mt-5 flex h-40 items-end gap-1.5">
                {a.daily.map((d) => (
                  <div key={d.date} className="group relative flex flex-1 flex-col items-center justify-end" title={`${d.date}: ${fmtInt(d.views)} views`}>
                    <div className="w-full rounded-t bg-gradient-to-t from-[var(--color-brand)]/40 to-[var(--color-brand)] transition-all" style={{ height: `${Math.max(2, (d.views / maxViews) * 100)}%` }} />
                    <span className="mt-1 text-[9px] text-[var(--color-text-muted)]">{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-[var(--color-text-muted)]">Loading…</p>
            )}
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
