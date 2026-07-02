"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { clearAdminToken } from "@/lib/auth";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/creators", label: "Creators" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/payments", label: "Payment Logs" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const path = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg-deep)]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/admin/dashboard" className="flex shrink-0 items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-brand)] text-[var(--color-on-brand)] shadow-[0_0_16px_-2px_rgba(34,197,94,0.6)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M8 5v14l11-7L8 5Z" fill="currentColor" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">
            Lumina <span className="text-[var(--color-text-muted)]">Admin</span>
          </span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto no-scrollbar">
          {LINKS.map((l) => {
            const active = path === l.href || path.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition duration-200 ${
                  active
                    ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => {
            clearAdminToken();
            qc.clear(); // drop cached admin data so it can't flash after sign-out
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
