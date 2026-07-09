"use client";

import { useState } from "react";
import Link from "next/link";
import { CreatorSidebar } from "@/components/creator/CreatorSidebar";
import { LuminaMark } from "@/components/ui/LuminaMark";

// Shared shell for every authenticated creator page. A slim top bar carries the
// hamburger that opens the SideShift-style left drawer (CreatorSidebar); the
// drawer holds the three creator functions. Auth-gating stays per-page.
export function CreatorLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-deep)]/80 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text)] transition hover:bg-[var(--color-surface)]"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <Link href="/campaigns" className="flex items-center gap-2">
          <LuminaMark size={26} />
          <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">Lumina Creators</span>
        </Link>
      </header>

      <CreatorSidebar open={open} onClose={() => setOpen(false)} />

      <main className="min-w-0">{children}</main>
    </div>
  );
}
