"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { getAdminToken } from "@/lib/auth";
import { getAdminStats } from "@/lib/admin";
import { isAuthError } from "@/lib/api";
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
    retry: false,
  });
  useEffect(() => {
    if (q.isError && isAuthError(q.error)) router.replace("/admin/login");
  }, [q.isError, q.error, router]);

  const s = q.data;

  return (
    <div className="min-h-[100dvh]">
      <AdminNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* ops-terminal header */}
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">
          Operations Terminal
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">
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

        {/* 4 stat cards */}
        {q.isError && !isAuthError(q.error) ? (
          <p className="mt-8 text-sm text-[var(--color-danger)]">{(q.error as Error).message}</p>
        ) : null}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Active campaigns"
            value={s ? fmtInt(s.active_campaigns) : "—"}
            hint={s ? `${fmtInt(s.total_campaigns)} total` : undefined}
            accent
          />
          <StatCard
            label="Creators"
            value={s ? fmtInt(s.total_creators) : "—"}
            hint={s ? `${fmtInt(s.completed_creators)} active` : undefined}
          />
          <StatCard
            label="Submissions"
            value={s ? fmtInt(s.total_submissions) : "—"}
            hint={s ? `${fmtInt(s.total_views)} views tracked` : undefined}
          />
          <StatCard
            label="Total budget"
            value={s ? fmtMoney(s.total_budget) : "—"}
            hint={s ? `${fmtInt(s.total_clients)} brand${s.total_clients === 1 ? "" : "s"}` : undefined}
          />
        </div>

        {/* recent campaigns */}
        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Recent campaigns</h2>
          <Link href="/admin/campaigns" className="text-sm text-[var(--color-brand)] hover:underline">
            View all →
          </Link>
        </div>
        <div className="card-lumina mt-3 rounded-[var(--radius-card)]">
          {q.isLoading ? (
            <p className="p-6 text-sm text-[var(--color-text-muted)]">Loading…</p>
          ) : !s?.recent_campaigns.length ? (
            <div className="p-8 text-center">
              <p className="text-[var(--color-text)]">No campaigns yet</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Create your first campaign to start tracking performance.
              </p>
            </div>
          ) : (
            <ul>
              {s.recent_campaigns.map((c, i) => (
                <li
                  key={c.id}
                  className={`flex items-center justify-between gap-4 px-5 py-4 ${
                    i > 0 ? "border-t border-[var(--color-border)]" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--color-text)]">{c.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      {c.mode === "create_new" ? "Original UGC" : "Approved clips"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-5 text-right">
                    <div className="hidden sm:block">
                      <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">CPM</p>
                      <p className="tabular text-sm text-[var(--color-text)]">{fmtMoney(c.cpm_rate)}</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Budget</p>
                      <p className="tabular text-sm text-[var(--color-text)]">{fmtMoney(c.budget)}</p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs capitalize ${
                        c.status === "active"
                          ? "border-[var(--color-brand)]/40 text-[var(--color-brand)]"
                          : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
