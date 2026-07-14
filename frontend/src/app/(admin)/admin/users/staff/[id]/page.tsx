"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAdminToken } from "@/lib/auth";
import { getStaffDetail } from "@/lib/admin";
import { isAuthError, retryNonAuth} from "@/lib/api";

export default function AdminStaffDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => { setHasToken(!!getAdminToken()); setReady(true); }, []);
  useEffect(() => { if (ready && !hasToken) router.replace("/admin/login"); }, [ready, hasToken, router]);

  const q = useQuery({ queryKey: ["staff", id], queryFn: () => getStaffDetail(id), enabled: ready && hasToken, retry: retryNonAuth });
  useEffect(() => { if (q.isError && isAuthError(q.error)) router.replace("/admin/login"); }, [q.isError, q.error, router]);

  if (!ready || !hasToken)
    return <main className="flex min-h-[100dvh] items-center justify-center"><p className="text-sm text-[var(--color-text-secondary)]">Loading…</p></main>;

  const s = q.data;

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/admin/users" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">← Users</Link>
        <AdminTabs />
        {!s ? (
          <p className="mt-8 text-sm text-[var(--color-text-secondary)]">Loading…</p>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-brand)]/15 text-lg font-semibold text-[var(--color-brand-soft)]">
                {s.email.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">{s.email}</h1>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm capitalize text-[var(--color-text-secondary)]">{s.role}</span>
                  <StatusBadge status={s.status} />
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="card-grad rounded-[var(--radius-card)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Role</p>
                <p className="mt-1 capitalize text-[var(--color-text)]">{s.role}</p>
              </div>
              <div className="card-grad rounded-[var(--radius-card)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Joined</p>
                <p className="mt-1 text-[var(--color-text)]">{new Date(s.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
