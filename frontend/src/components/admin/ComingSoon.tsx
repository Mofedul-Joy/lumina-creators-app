"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { getAdminToken } from "@/lib/auth";

export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!getAdminToken()) router.replace("/admin/login");
    else setReady(true);
  }, [router]);
  if (!ready) return null;

  return (
    <div className="min-h-[100dvh]">
      <AdminNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">
          Operations Terminal
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">{title}</h1>

        <div className="card-lumina mt-8 flex flex-col items-center gap-3 rounded-[var(--radius-card)] px-6 py-16 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full border border-[var(--color-brand)]/30 text-[var(--color-brand)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
            </svg>
          </span>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Coming soon</h2>
          <p className="max-w-md text-sm text-[var(--color-text-secondary)]">{blurb}</p>
        </div>
      </main>
    </div>
  );
}
