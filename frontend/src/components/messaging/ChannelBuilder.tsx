"use client";

import { retryNonAuth } from "@/lib/api";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { listCreators } from "@/lib/admin";
import { createChannel, type Conversation } from "@/lib/messaging";

/**
 * Admin-only slide-over to spin up a group channel: name it, pick creators,
 * create. Rendered on top of the conversation list inside the drawer.
 */
export function ChannelBuilder({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Conversation) => void }) {
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({}); // id → name

  const creatorsQ = useQuery({ queryKey: ["admin-creators-lite"], queryFn: () => listCreators({}), retry: retryNonAuth });
  const creators = useMemo(() => {
    const list = creatorsQ.data ?? [];
    const q = search.trim().toLowerCase();
    return q ? list.filter((c) => (c.display_name ?? c.email).toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) : list;
  }, [creatorsQ.data, search]);

  const createM = useMutation({
    mutationFn: () => createChannel(title.trim(), Object.keys(picked)),
    onSuccess: (c) => onCreated(c),
  });

  const pickedIds = Object.keys(picked);
  const canCreate = title.trim().length > 0 && pickedIds.length > 0 && !createM.isPending;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[var(--color-bg-deep)]">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)]/60 px-3 py-3">
        <button onClick={onClose} aria-label="Back" className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <p className="flex-1 text-sm font-semibold text-[var(--color-text)]">New channel</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Channel name</label>
        <input
          value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer Launch Squad" autoFocus
          className="mb-4 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus-visible:border-[var(--color-brand)]"
        />

        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Members {pickedIds.length ? `· ${pickedIds.length} selected` : ""}
        </label>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search creators…"
          className="mb-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus-visible:border-[var(--color-brand)]"
        />
        <div className="space-y-0.5">
          {creatorsQ.isLoading ? (
            <p className="px-1 py-3 text-xs text-[var(--color-text-muted)]">Loading creators…</p>
          ) : creators.length === 0 ? (
            <p className="px-1 py-3 text-xs text-[var(--color-text-muted)]">No creators found.</p>
          ) : (
            creators.map((c) => {
              const name = c.display_name || c.email.split("@")[0];
              const on = c.id in picked;
              return (
                <button
                  key={c.id} type="button"
                  onClick={() => setPicked((p) => { const n = { ...p }; if (on) delete n[c.id]; else n[c.id] = name; return n; })}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-[var(--color-surface)]/60"
                >
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${on ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "border-[var(--color-border)]"}`}>
                    {on ? <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
                  </span>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-xs font-semibold text-[var(--color-text-muted)]">{name.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[var(--color-text)]">{name}</p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">{c.email}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="border-t border-[var(--color-border)]/60 p-3">
        {createM.isError ? <p className="mb-2 text-center text-xs text-[var(--color-danger,#ef6a6a)]">Couldn&apos;t create the channel. Try again.</p> : null}
        <button
          onClick={() => createM.mutate()} disabled={!canCreate}
          className="w-full cursor-pointer rounded-xl bg-[var(--color-brand)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:opacity-40"
        >
          {createM.isPending ? "Creating…" : "Create channel"}
        </button>
      </div>
    </div>
  );
}
