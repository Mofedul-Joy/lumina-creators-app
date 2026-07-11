"use client";

import { useEffect, useState } from "react";
import { downloadCreatorsCsv } from "@/lib/admin";

// Columns the export carries — listed so the admin knows what they're getting
// before the file lands in Downloads.
const COLUMNS = [
  "Name", "Email", "Phone", "Profile details", "Post activity", "Views trend",
  "Accounts", "GMV", "Campaigns", "Collections", "Tags", "Created at",
  "Status", "Performance", "Total earnings", "Contracts",
];

export function ExportCreatorsModal({
  open,
  onClose,
  total,
}: {
  open: boolean;
  onClose: () => void;
  total: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function download() {
    setBusy(true);
    setError(null);
    try {
      await downloadCreatorsCsv();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="export-title">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" />
      <div className="card-lumina relative w-full max-w-md rounded-[var(--radius-card)] p-7">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 id="export-title" className="text-center text-xl font-semibold text-[var(--color-text)]">
          Download CSV of creators
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-[var(--color-text-secondary)]">
          Exports all {total} creator{total === 1 ? "" : "s"} in your database — not just this page.
        </p>

        <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
          <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Included columns</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COLUMNS.map((c) => (
              <span key={c} className="rounded-full bg-[var(--color-surface)] px-2.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
                {c}
              </span>
            ))}
          </div>
        </div>

        {error ? <p className="mt-4 text-center text-sm text-[var(--color-danger)]">{error}</p> : null}

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={download}
            disabled={busy}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:opacity-60"
          >
            {busy ? "Preparing…" : "Download CSV"}
          </button>
          <button
            onClick={onClose}
            className="min-h-11 cursor-pointer rounded-full px-5 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
