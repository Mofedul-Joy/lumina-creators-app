"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { clearAdminToken } from "@/lib/auth";

// Slim persistent shell: logo + sign out only. The actual section nav lives in
// AdminTabs, rendered per-page right below that page's own header/action row —
// keeping the two concerns (identity/session chrome vs. page navigation) apart
// instead of one sticky bar trying to be both.
export function AdminShell() {
  const router = useRouter();
  const qc = useQueryClient();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg-deep)]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/admin/dashboard" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-brand)] text-[var(--color-on-brand)] shadow-[0_0_16px_-2px_rgba(34,197,94,0.6)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M8 5v14l11-7L8 5Z" fill="currentColor" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">
            Lumina <span className="text-[var(--color-text-muted)]">Admin</span>
          </span>
        </Link>

        <button
          onClick={() => {
            clearAdminToken();
            qc.clear();
            router.push("/admin/login");
          }}
          className="shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
