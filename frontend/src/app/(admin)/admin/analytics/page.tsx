"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { getAdminToken } from "@/lib/auth";
import { getAdminAnalytics } from "@/lib/admin";
import { isAuthError } from "@/lib/api";
import { fmtCompact, fmtInt, fmtMoney } from "@/lib/format";

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "X",
  facebook: "Facebook",
};

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="card-grad rounded-[var(--radius-card)] p-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
      <p className={`tabular mt-3 text-3xl font-semibold ${accent ? "text-[var(--color-brand-soft)]" : "text-[var(--color-text)]"}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{hint}</p> : null}
    </div>
  );
}

function DailyChart({ daily }: { daily: { date: string; views: number }[] }) {
  const max = Math.max(...daily.map((d) => d.views), 1);
  const fmtDay = (iso: string) =>
    iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
  return (
    <div>
      <div className="flex h-44 items-end gap-1">
        {daily.map((d) => (
          <div
            key={d.date}
            className="flex-1 rounded-t-sm bg-[var(--color-brand)]/60 transition-colors hover:bg-[var(--color-brand)]"
            style={{ height: `${Math.max(2, (d.views / max) * 100)}%` }}
            title={`${fmtDay(d.date)}: ${fmtInt(d.views)} views`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-[var(--color-text-muted)]">
        <span>{fmtDay(daily[0]?.date ?? "")}</span>
        <span>{fmtDay(daily[Math.floor(daily.length / 2)]?.date ?? "")}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
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
    queryKey: ["admin-analytics"],
    queryFn: getAdminAnalytics,
    enabled: ready && hasToken,
    retry: false,
  });
  useEffect(() => {
    if (q.isError && isAuthError(q.error)) router.replace("/admin/login");
  }, [q.isError, q.error, router]);

  if (!ready || !hasToken)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );

  const a = q.data;
  const maxPlatform = Math.max(...(a?.by_platform.map((p) => p.views) ?? [1]), 1);

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Analytics</h1>
        <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
          Network-wide performance across every campaign and creator.
        </p>
        <AdminTabs />

        {q.isLoading ? (
          <p className="mt-10 text-sm text-[var(--color-text-secondary)]">Loading analytics…</p>
        ) : !a ? null : (
          <>
            {/* KPI row */}
            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
              <Kpi label="Total views" value={fmtCompact(a.kpis.total_views)} hint={`${fmtInt(a.kpis.total_views)} verified views`} accent />
              <Kpi label="Ad spend" value={fmtMoney(a.kpis.total_spend)} hint="Estimated payout to creators" />
              <Kpi label="Effective CPM" value={fmtMoney(a.kpis.avg_cpm)} hint="Cost per 1,000 views" />
              <Kpi label="Submissions" value={fmtInt(a.kpis.total_submissions)} hint={`${fmtInt(a.kpis.verified_submissions)} verified`} />
              <Kpi label="Active creators" value={fmtInt(a.kpis.active_creators)} hint="Posted to a campaign" />
              <Kpi label="Engagement" value={`${Number(a.kpis.engagement_rate).toFixed(1)}%`} hint="Likes + comments / views" />
            </div>

            {/* activity chart */}
            <div className="card-lumina mt-6 rounded-[var(--radius-card)] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--color-text)]">Views over the last 30 days</h2>
                <span className="text-xs text-[var(--color-text-muted)]">by submission date</span>
              </div>
              <DailyChart daily={a.daily} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {/* platform breakdown */}
              <div className="card-lumina rounded-[var(--radius-card)] p-6">
                <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Views by platform</h2>
                <div className="space-y-4">
                  {a.by_platform.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-secondary)]">No submissions yet.</p>
                  ) : (
                    a.by_platform.map((p) => (
                      <div key={p.platform}>
                        <div className="mb-1 flex justify-between text-sm">
                          <span className="text-[var(--color-text)]">{PLATFORM_LABEL[p.platform] ?? p.platform}</span>
                          <span className="tabular text-[var(--color-text-secondary)]">{fmtInt(p.views)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                          <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${(p.views / maxPlatform) * 100}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* top creators */}
              <div className="card-lumina rounded-[var(--radius-card)] p-6">
                <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Top creators</h2>
                <div className="space-y-1">
                  {a.top_creators.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-secondary)]">No creators have posted yet.</p>
                  ) : (
                    a.top_creators.map((c, i) => (
                      <div key={c.id} className="flex items-center justify-between border-b border-[var(--color-border)]/50 py-2 last:border-0">
                        <span className="flex items-center gap-3">
                          <span className="tabular w-5 text-sm text-[var(--color-text-muted)]">{i + 1}</span>
                          <span className="text-[var(--color-text)]">{c.display_name}</span>
                        </span>
                        <span className="text-right">
                          <span className="tabular block text-sm text-[var(--color-text)]">{fmtCompact(c.views)} views</span>
                          <span className="text-xs text-[var(--color-text-muted)]">{c.submissions} clips</span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* top campaigns */}
            <div className="card-lumina mt-6 rounded-[var(--radius-card)] p-6">
              <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Top campaigns</h2>
              {a.top_campaigns.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">No campaign activity yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                        <th className="pb-2 font-medium">Campaign</th>
                        <th className="pb-2 text-right font-medium">Views</th>
                        <th className="pb-2 text-right font-medium">Clips</th>
                        <th className="pb-2 text-right font-medium">Spend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.top_campaigns.map((c) => (
                        <tr key={c.id} className="border-t border-[var(--color-border)]/50">
                          <td className="py-3 text-[var(--color-text)]">{c.name}</td>
                          <td className="tabular py-3 text-right text-[var(--color-text-secondary)]">{fmtInt(c.views)}</td>
                          <td className="tabular py-3 text-right text-[var(--color-text-secondary)]">{c.submissions}</td>
                          <td className="tabular py-3 text-right text-[var(--color-text-secondary)]">{fmtMoney(c.spend)}</td>
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
