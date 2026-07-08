"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { CreatorDetailCard } from "@/components/admin/CreatorDetailCard";
import { getAdminToken } from "@/lib/auth";
import { flagCreatorSuspicious, getCreatorDetail, isAuthError, unflagCreatorSuspicious } from "@/lib/api";

const cardCls =
  "card-grad rounded-[var(--radius-card)] p-5 space-y-4";

export default function AdminCreatorDetailPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [confirmingFlag, setConfirmingFlag] = useState(false);

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
    retry: false,
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
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
      <Link href="/admin/creators" className="text-sm text-[var(--color-brand)] underline">
        ← Back to database
      </Link>
      <AdminTabs />

      <header className="flex items-start justify-end gap-4">
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
          {c.is_suspicious ? (
            <div className="flex items-center gap-2">
              <span className="rounded-[var(--radius-pill)] bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-400">Flagged suspicious</span>
              <button
                disabled={unflagM.isPending}
                onClick={() => unflagM.mutate()}
                className="cursor-pointer text-xs text-[var(--color-text-muted)] underline hover:text-[var(--color-text)] disabled:opacity-50"
              >
                Unflag
              </button>
            </div>
          ) : confirmingFlag ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-secondary)]">Flag every current and future submission?</span>
              <button onClick={() => setConfirmingFlag(false)} className="cursor-pointer text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Cancel</button>
              <button
                disabled={flagM.isPending}
                onClick={() => flagM.mutate()}
                className="cursor-pointer rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/25 disabled:opacity-50"
              >
                Confirm flag
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingFlag(true)}
              className="cursor-pointer text-xs text-[var(--color-text-muted)] underline hover:text-[var(--color-text)]"
            >
              Flag as suspicious
            </button>
          )}
        </div>
      </header>

      <section className={cardCls}>
        <CreatorDetailCard creatorId={id} />
      </section>
      </main>
    </div>
  );
}
