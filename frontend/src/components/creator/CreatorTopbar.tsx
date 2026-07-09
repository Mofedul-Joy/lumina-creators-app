"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getMyGamification } from "@/lib/gamification";
import { RankBadge } from "@/components/gamification/RankBadge";
import { LuminaMark } from "@/components/ui/LuminaMark";

// The SideShift-style top bar: a mobile hamburger on the left, and a right-hand
// cluster of rank / streak chips + a notification bell — themed for Lumina.
export function CreatorTopbar({ onMenu }: { onMenu: () => void }) {
  const g = useQuery({ queryKey: ["my-gamification"], queryFn: getMyGamification, retry: false }).data;

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--color-border)]/60 bg-[var(--color-bg-deep)]/80 px-4 py-3 backdrop-blur-xl lg:px-6">
      {/* mobile: hamburger + brand */}
      <button onClick={onMenu} aria-label="Open menu" className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text)] transition hover:bg-[var(--color-surface)] lg:hidden">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
        <LuminaMark size={24} />
      </Link>

      <div className="ml-auto flex items-center gap-2">
        {g ? (
          <>
            <span className="hidden sm:inline-flex">
              <RankBadge rank={g.rank} size="sm" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--color-brand-soft)]">
              <span aria-hidden>🔥</span>
              <span className="tabular">{g.streak_days}</span>
            </span>
          </>
        ) : null}

        {/* notification bell (top-right, SideShift-style) */}
        <Link href="/messages" aria-label="Notifications" className="relative grid h-9 w-9 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] transition hover:border-[var(--color-text-muted)]">
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--color-brand)] ring-2 ring-[var(--color-bg-deep)]" />
        </Link>
      </div>
    </header>
  );
}
