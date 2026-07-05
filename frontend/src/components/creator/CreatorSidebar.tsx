"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { clearAuthToken } from "@/lib/auth";

function DashboardIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="2" /></svg>;
}
function CampaignsIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v10H8l-4 4V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
}
function SubmissionsIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7L8 5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
}
function ProfileIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" /><path d="M4.5 20c1.5-4 5-6 7.5-6s6 2 7.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/campaigns", label: "Campaigns", icon: CampaignsIcon },
  { href: "/submissions", label: "Submissions", icon: SubmissionsIcon },
  { href: "/onboarding", label: "Profile", icon: ProfileIcon },
] as const;

export function CreatorSidebar() {
  const path = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <>
      {/* desktop sidebar — deliberately subtle: no hard divider, soft
          brand-tinted active pill, muted idle items */}
      <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col bg-[var(--color-bg-deep)]/40 px-4 py-6 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-brand)] text-[var(--color-on-brand)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M8 5v14l11-7L8 5Z" fill="currentColor" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">Lumina Creators</span>
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-0.5">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                isActive(href)
                  ? "bg-[var(--color-brand)]/10 font-medium text-[var(--color-brand-soft)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              <Icon />
              {label}
            </Link>
          ))}
        </nav>

        <div className="relative">
          {menuOpen ? (
            <div className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-xl bg-[var(--color-surface)] shadow-xl ring-1 ring-white/[0.06]">
              <button
                onClick={() => { clearAuthToken(); router.push("/"); }}
                className="block w-full cursor-pointer px-4 py-2.5 text-left text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
              >
                Sign out
              </button>
            </div>
          ) : null}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-xs font-semibold text-[var(--color-text)]">
              <ProfileIcon />
            </span>
            Account
          </button>
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-deep)]/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-brand)] text-[var(--color-on-brand)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M8 5v14l11-7L8 5Z" fill="currentColor" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">Lumina Creators</span>
        </Link>
        <button
          onClick={() => { clearAuthToken(); router.push("/"); }}
          className="cursor-pointer text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
        >
          Sign out
        </button>
      </header>

      {/* mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-[var(--color-border)] bg-[var(--color-bg-deep)]/90 py-2 backdrop-blur-xl lg:hidden">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] ${
              isActive(href) ? "text-[var(--color-brand)]" : "text-[var(--color-text-muted)]"
            }`}
          >
            <Icon />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
