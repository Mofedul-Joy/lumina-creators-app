"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { CreatorDetailCard } from "@/components/admin/CreatorDetailCard";
// Both open on a click ("Pay now" / "Remove creator"), so keep them out of the
// creator detail page's initial bundle.
const PayCreatorModal = dynamic(
  () => import("@/components/admin/PayCreatorModal").then((m) => m.PayCreatorModal),
  { ssr: false },
);
const RemoveCreatorModal = dynamic(
  () => import("@/components/admin/RemoveCreatorModal").then((m) => m.RemoveCreatorModal),
  { ssr: false },
);
import { WeeklyPostChart } from "@/components/admin/charts/WeeklyPostChart";
import { ViewsGrowthChart } from "@/components/admin/charts/ViewsGrowthChart";
import { Skeleton } from "@/components/ui/Skeleton";
import { getAdminToken } from "@/lib/auth";
import { getCreatorActivity } from "@/lib/admin";
import { fmtInt, fmtMoney } from "@/lib/format";
import { flagCreatorSuspicious, getCreatorDetail, isAuthError, unflagCreatorSuspicious, retryNonAuth} from "@/lib/api";

const cardCls =
  "card-grad rounded-[var(--radius-card)] p-5 space-y-4";

const FlagIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5 21V4m0 0h11l-1.6 3.5L16 11H5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card-grad rounded-[var(--radius-card)] p-4">
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="tabular mt-1.5 text-2xl font-semibold text-[var(--color-text)]">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{sub}</p> : null}
    </div>
  );
}

export default function AdminCreatorDetailPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [confirmingFlag, setConfirmingFlag] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setToken(getAdminToken());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && !token) router.replace("/admin/login");
  }, [ready, token, router]);

  const detailQ = useQuery({
    queryKey: ["admin-creator", id],
    queryFn: () => getCreatorDetail(token ?? "", id),
    enabled: ready && !!token && !!id,
    retry: retryNonAuth,
  });

  const activityQ = useQuery({
    queryKey: ["admin-creator-activity", id],
    queryFn: () => getCreatorActivity(id),
    enabled: ready && !!token && !!id,
    retry: retryNonAuth,
  });

  useEffect(() => {
    if (detailQ.isError && isAuthError(detailQ.error)) router.replace("/admin/login");
  }, [detailQ.isError, detailQ.error, router]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-creator", id] });
  const flagM = useMutation({
    mutationFn: () => flagCreatorSuspicious(token ?? "", id),
    onSuccess: () => { setConfirmingFlag(false); refresh(); },
  });
  const unflagM = useMutation({ mutationFn: () => unflagCreatorSuspicious(token ?? "", id), onSuccess: refresh });

  if (!ready || !token || detailQ.isLoading)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );

  const c = detailQ.data;
  if (!c)
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-[var(--color-danger)]">Creator not found.</p>
        <Link href="/admin/creators" className="mt-4 inline-block text-sm text-[var(--color-brand)] underline">
          Back to database
        </Link>
      </main>
    );

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <Link
        href="/admin/creators"
        aria-label="Back to database"
        title="Back to database"
        className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-sm transition hover:-translate-x-0.5 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Link>
      <AdminTabs />

      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPayOpen(true)}
            className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[var(--color-brand)] px-4 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M3 7h18v10H3zM3 10h18M7 14h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Pay now
          </button>
          <button
            onClick={() => setRemoveOpen(true)}
            className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-[var(--color-danger)]/40 px-4 text-sm font-medium text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/10"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Remove creator
          </button>

          {/* Flag-suspicious control lives right beside Remove creator, same
              size, but a solid (brighter) red so it reads as the stronger
              action. Every state — flag / confirm / flagged — renders here. */}
          {c.is_suspicious ? (
            <>
              <span className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-[#e5484d] px-4 text-sm font-semibold text-white">
                <FlagIcon />
                Flagged suspicious
              </span>
              <button
                disabled={unflagM.isPending}
                onClick={() => unflagM.mutate()}
                className="inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-full border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)] disabled:opacity-50"
              >
                {unflagM.isPending ? "Unflagging…" : "Unflag"}
              </button>
            </>
          ) : confirmingFlag ? (
            <>
              <button
                disabled={flagM.isPending}
                onClick={() => flagM.mutate()}
                className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[#e5484d] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#f2555a] disabled:opacity-50"
              >
                <FlagIcon />
                {flagM.isPending ? "Flagging…" : "Confirm flag"}
              </button>
              <button
                onClick={() => setConfirmingFlag(false)}
                className="inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-full border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmingFlag(true)}
              className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full bg-[#e5484d] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#f2555a]"
            >
              <FlagIcon />
              Flag as suspicious
            </button>
          )}
        </div>

        {payOpen ? (
          <PayCreatorModal
            creator={c}
            owed={Number(activityQ.data?.total_owed ?? 0)}
            onClose={() => setPayOpen(false)}
          />
        ) : null}

        <RemoveCreatorModal
          open={removeOpen}
          onClose={() => setRemoveOpen(false)}
          creatorId={id}
          creatorName={c.display_name || c.email}
          onRemoved={() => router.push("/admin/creators")}
        />

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className="rounded-[var(--radius-pill)] px-3 py-1 text-xs font-medium"
            style={{
              color: c.completed ? "var(--color-on-brand)" : "var(--color-text-secondary)",
              background: c.completed ? "var(--color-brand)" : "var(--color-surface-2)",
            }}
          >
            {c.completed ? "Complete" : "Incomplete"}
          </span>
          {confirmingFlag && !c.is_suspicious ? (
            <span className="text-xs text-[var(--color-text-muted)]">Flags every current and future submission.</span>
          ) : null}
        </div>
      </header>

      {/* Performance charts (SideShift-style): posts this week vs last, and
          views over time. Both have cursor-following hover tooltips. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={cardCls}>
          {activityQ.data ? (
            <WeeklyPostChart data={activityQ.data.weekly_posts} />
          ) : (
            <Skeleton className="h-56 w-full" />
          )}
        </section>
        <section className={cardCls}>
          {activityQ.data ? (
            <ViewsGrowthChart data={activityQ.data.views_growth} />
          ) : (
            <Skeleton className="h-56 w-full" />
          )}
        </section>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Total posts" value={fmtInt(activityQ.data?.total_posts ?? 0)} />
        <StatTile label="Total views" value={fmtInt(activityQ.data?.total_views ?? 0)} />
        <StatTile
          label="Total owed"
          value={fmtMoney(activityQ.data?.total_owed ?? 0)}
          sub={`Paid so far: ${fmtMoney(activityQ.data?.total_paid ?? 0)}`}
        />
        <StatTile label="Avg CPM" value={fmtMoney(activityQ.data?.avg_cpm ?? 0)} />
      </div>

      <section className={cardCls}>
        <CreatorDetailCard creatorId={id} />
      </section>
      </main>
    </div>
  );
}
