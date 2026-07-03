"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { clearAdminToken } from "@/lib/auth";

type Sub = { href: string; label: string };
type Item = { href: string; label: string; subs?: Sub[] };

const NAV: Item[] = [
  { href: "/admin/dashboard", label: "Dashboard" },
  {
    href: "/admin/campaigns",
    label: "Campaigns",
    subs: [
      { href: "/admin/campaigns", label: "All campaigns" },
      { href: "/admin/campaigns/new", label: "New campaign" },
    ],
  },
  { href: "/admin/creators", label: "Creators" },
  { href: "/admin/analytics", label: "Analytics" },
  {
    href: "/admin/payments",
    label: "Payments",
    subs: [
      { href: "/admin/payments#outstanding", label: "Outstanding balances" },
      { href: "/admin/payments#history", label: "Payout history" },
    ],
  },
  {
    href: "/admin/users",
    label: "Users",
    subs: [
      { href: "/admin/users#staff", label: "Staff" },
      { href: "/admin/users/brands", label: "Brand accounts" },
    ],
  },
  { href: "/admin/settings", label: "Settings" },
];

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden className="opacity-60">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Dropdown menu. The wrapper uses top-full + pt-2 (padding, NOT margin) so there's
// no dead gap between trigger and menu — the pointer stays inside the `group`
// hover area the whole way down, so the menu no longer vanishes mid-select.
function Dropdown({ items }: { items: Sub[] }) {
  return (
    <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
      <div className="w-52 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
        {items.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AdminNav() {
  const path = usePathname();
  const router = useRouter();
  const qc = useQueryClient();

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm transition duration-200 ${
      active
        ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg-deep)]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        {/* logo + quick-actions dropdown */}
        <div className="group relative shrink-0">
          <div className="flex items-center gap-1">
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
            <span className="text-[var(--color-text-muted)] transition group-hover:text-[var(--color-text)]"><Chevron /></span>
          </div>
          <Dropdown items={[{ href: "/admin/campaigns/new", label: "New campaign" }, { href: "/admin/creators", label: "Browse creators" }]} />
        </div>

        {/* main nav — each tool with an optional hover dropdown */}
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto no-scrollbar">
          {NAV.map((item) => {
            const active = path === item.href || path.startsWith(item.href + "/");
            if (!item.subs) {
              return <Link key={item.href} href={item.href} className={`shrink-0 ${chip(active)}`}>{item.label}</Link>;
            }
            return (
              <div key={item.href} className="group relative shrink-0">
                <Link href={item.href} className={chip(active)}>
                  {item.label}
                  <Chevron />
                </Link>
                <Dropdown items={item.subs} />
              </div>
            );
          })}
        </nav>

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
