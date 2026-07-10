"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearAdminToken } from "@/lib/auth";
import { LuminaMark } from "@/components/ui/LuminaMark";

// SideShift-style collapsible left rail. One click on the toggle slides it
// between icon-only (72px) and full (232px); the choice is remembered.
const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "M3 12l2-2 4 4 6-6 4 4M3 20h18" },
  { href: "/admin/campaigns", label: "Campaigns", icon: "M3 11l18-5v12L3 15zM11.6 16.8a3 3 0 11-5.8-1.6" },
  { href: "/admin/creators", label: "Creators", icon: "M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M21 21v-2a4 4 0 00-3-3.9" },
  { href: "/admin/applicants", label: "Applicants", icon: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M19 8v6M22 11h-6" },
  { href: "/admin/payments", label: "Payments", icon: "M2 7h20v10H2zM2 11h20M6 15h4" },
  { href: "/admin/users", label: "Users", icon: "M3 5h18v14H3zM3 9h18M8 13h5" },
  { href: "/admin/settings", label: "Settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1A1.7 1.7 0 004.6 19l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00-1.2-2.9H0a2 2 0 110-4h.1A1.7 1.7 0 001.3 4.6l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H6a1.7 1.7 0 001-1.5V0a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V6a1.7 1.7 0 001.5 1H24a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" },
] as const;

export function AdminSidebar() {
  const path = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    // Honor a saved preference; otherwise default open on desktop, collapsed on
    // narrow screens so /admin pages don't lose most of the viewport on mobile.
    const stored = localStorage.getItem("admin-sidebar-collapsed");
    setOpen(stored ? stored !== "1" : window.innerWidth >= 1024);
  }, []);
  const toggle = () => {
    setOpen((v) => {
      localStorage.setItem("admin-sidebar-collapsed", v ? "1" : "0");
      return !v;
    });
  };

  return (
    <aside
      className={`sticky top-0 z-40 flex h-dvh shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-deep)]/80 backdrop-blur-xl transition-[width] duration-200 ${
        open ? "w-[232px]" : "w-[72px]"
      }`}
    >
      {/* Brand + toggle */}
      <div className="flex h-14 items-center gap-2 px-4">
        <Link href="/admin/dashboard" className="flex min-w-0 items-center gap-2" aria-label="Lumina Admin">
          <LuminaMark size={26} />
          {open ? (
            <span className="truncate text-[15px] font-semibold tracking-tight text-[var(--color-text)]">
              Lumina <span className="text-[var(--color-text-muted)]">Admin</span>
            </span>
          ) : null}
        </Link>
        <button
          onClick={toggle}
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          className={`ml-auto grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] ${
            open ? "" : "mx-auto"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M9 4v16" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {NAV.map((item) => {
          const active = path === item.href || path.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={open ? undefined : item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm transition ${
                active
                  ? "bg-[var(--color-brand)]/15 font-medium text-[var(--color-brand)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
              } ${open ? "" : "justify-center"}`}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden>
                <path d={item.icon} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {open ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="border-t border-[var(--color-border)] p-3">
        <button
          onClick={() => {
            clearAdminToken();
            qc.clear();
            router.push("/admin/login");
          }}
          title={open ? undefined : "Sign out"}
          aria-label="Sign out"
          className={`flex h-10 w-full items-center gap-3 rounded-lg px-2.5 text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] ${
            open ? "" : "justify-center"
          }`}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden>
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {open ? <span>Sign out</span> : null}
        </button>
      </div>
    </aside>
  );
}
