"use client";

import { useEffect, useRef, useState } from "react";
import { NICHES } from "@/lib/niches";

// SideShift-style search overlay, in Lumina's theme: a search field, a few
// suggested searches, and the browse-by-niche list. Emits either a free-text
// query or a niche key back to the Explore page, which owns the filtering.
const SUGGESTED = ["Content creation", "UGC videos", "App reviews", "Product reviews", "High-volume UGC"];

export function CampaignSearchModal({
  open,
  onClose,
  onSearch,
  onNiche,
}: {
  open: boolean;
  onClose: () => void;
  onSearch: (q: string) => void;
  onNiche: (key: string) => void;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset + focus only when the overlay actually opens.
  useEffect(() => {
    if (!open) return;
    setQ("");
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => { clearTimeout(t); };
  }, [open]);

  if (!open) return null;

  const runSearch = (term: string) => { onSearch(term.trim()); onClose(); };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[8vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Search campaigns"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-2xl sm:p-5"
      >
        {/* search field */}
        <div className="flex items-center gap-2">
          <form
            onSubmit={(e) => { e.preventDefault(); if (q.trim()) runSearch(q); }}
            className="flex flex-1 items-center gap-2.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-4 py-2.5"
          >
            <svg className="h-[18px] w-[18px] shrink-0 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search campaigns…"
              className="w-full bg-transparent text-[15px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none"
            />
          </form>
          <button
            onClick={onClose}
            aria-label="Close search"
            className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* suggested searches */}
        <div className="mt-5">
          <p className="px-1 text-sm font-semibold text-[var(--color-text)]">Suggested searches</p>
          <div className="mt-2 space-y-0.5">
            {SUGGESTED.map((s) => (
              <button
                key={s}
                onClick={() => runSearch(s)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
              >
                <svg className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* browse by niche */}
        <div className="mt-5">
          <p className="px-1 text-sm font-semibold text-[var(--color-text)]">Browse by niche</p>
          <div className="mt-2 grid grid-cols-1 gap-0.5 sm:grid-cols-2">
            {NICHES.map((n) => (
              <button
                key={n.key}
                onClick={() => { onNiche(n.key); onClose(); }}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--color-surface-2)] text-[var(--color-brand-soft)]">
                  <n.Icon />
                </span>
                {n.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
