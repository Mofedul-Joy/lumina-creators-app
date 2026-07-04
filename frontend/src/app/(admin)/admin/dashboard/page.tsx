"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { SubmissionsSection } from "@/components/admin/SubmissionsSection";
import { getAdminToken } from "@/lib/auth";
import { getAdminStats } from "@/lib/admin";
import { isAuthError } from "@/lib/api";
import { fmtInt } from "@/lib/format";

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

  // Don't render dashboard data until we've confirmed a token — prevents a
  // flash of cached stats after sign-out before the redirect fires.
  if (!ready || !hasToken)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );

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

        {/* stat cards — Bill: "Active campaigns, creators, submissions, that's enough" */}
        {q.isError && !isAuthError(q.error) ? (
          <p className="mt-8 text-sm text-[var(--color-danger)]">{(q.error as Error).message}</p>
        ) : null}
        <div className="mt-8 grid grid-cols-3 gap-4">
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
        </div>

        {/* submissions front-and-center — Bill: "as an admin the first thing I want
            to see is just go straight into submissions" (campaigns live in the nav) */}
        <div className="mt-10">
          <SubmissionsSection />
        </div>
      </main>
    </div>
  );
}
