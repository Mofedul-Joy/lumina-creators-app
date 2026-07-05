"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Section nav, rendered by each admin page itself right below that page's own
// header/action-button row — not in a shared layout — so it sits visually
// lower than a typical top navbar, next to whatever that page's primary
// actions are, instead of competing with them at the very top of the screen.
const TABS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/creators", label: "Creators" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export function AdminTabs() {
  const path = usePathname();

  return (
    <nav className="mt-6 mb-6 flex gap-1 overflow-x-auto border-b border-[var(--color-border)] no-scrollbar">
      {TABS.map((tab) => {
        const active = path === tab.href || path.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm transition ${
              active
                ? "border-[var(--color-brand)] text-[var(--color-text)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
