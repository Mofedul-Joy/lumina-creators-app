"use client";

import { useEffect, useState } from "react";
import { removeCreator, type RemovalMode, type RemovalScope } from "@/lib/admin";

const MODES: { key: RemovalMode; label: string; blurb: string }[] = [
  {
    key: "delete_all",
    label: "Delete all data",
    blurb: "Posts, analytics, and contracts across all campaigns will be permanently deleted",
  },
  {
    key: "keep_analytics",
    label: "Keep analytics",
    blurb: "Creator removed from all campaigns, but posts and views continue tracking",
  },
  {
    key: "keep_posts",
    label: "Keep posts for payouts",
    blurb: "Existing posts earn payouts, but new posts won't be tracked",
  },
];

const SCOPES: { key: RemovalScope; label: string; blurb: string }[] = [
  {
    key: "campaigns_only",
    label: "Remove campaign access only",
    blurb: "Detach this creator from the campaigns they've joined",
  },
  {
    key: "entire",
    label: "Remove from the platform entirely",
    blurb: "Also suspend the account — they lose access to Lumina Creators",
  },
];

function Radio({
  checked,
  label,
  blurb,
  onSelect,
}: {
  checked: boolean;
  label: string;
  blurb: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition ${
        checked
          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10"
          : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-text-muted)]"
      }`}
    >
      <span
        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
          checked ? "border-[var(--color-brand)]" : "border-[var(--color-text-muted)]"
        }`}
      >
        {checked ? <span className="h-2 w-2 rounded-full bg-[var(--color-brand)]" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--color-text)]">{label}</span>
        <span className="mt-0.5 block text-sm leading-6 text-[var(--color-text-secondary)]">{blurb}</span>
      </span>
    </button>
  );
}

export function RemoveCreatorModal({
  open,
  onClose,
  creatorId,
  creatorName,
  onRemoved,
}: {
  open: boolean;
  onClose: () => void;
  creatorId: string;
  creatorName: string;
  onRemoved: () => void;
}) {
  const [mode, setMode] = useState<RemovalMode>("delete_all");
  const [scope, setScope] = useState<RemovalScope>("campaigns_only");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("delete_all");
    setScope("campaigns_only");
    setError(null);
  }, [open]);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await removeCreator(creatorId, mode, scope);
      onRemoved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove this creator.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="remove-title">
      <div aria-hidden className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" />
      <div className="card-lumina relative my-auto w-full max-w-md rounded-[var(--radius-card)] p-7">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-danger)]/15 text-[var(--color-danger)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 id="remove-title" className="text-center text-xl font-semibold text-[var(--color-text)]">
          Remove creator
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-center text-sm leading-6 text-[var(--color-text-secondary)]">
          Are you sure you want to remove{" "}
          <span className="text-[var(--color-text)]">{creatorName}</span> from your database?
        </p>

        <div className="mt-5 space-y-2.5">
          {MODES.map((m) => (
            <Radio
              key={m.key}
              checked={mode === m.key}
              label={m.label}
              blurb={m.blurb}
              onSelect={() => setMode(m.key)}
            />
          ))}
        </div>

        <p className="mt-6 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
          Platform access
        </p>
        <div className="mt-2 space-y-2.5">
          {SCOPES.map((s) => (
            <Radio
              key={s.key}
              checked={scope === s.key}
              label={s.label}
              blurb={s.blurb}
              onSelect={() => setScope(s.key)}
            />
          ))}
        </div>

        {/* Financial integrity: a paid creator can't be erased, so say so up front
            rather than surprising the admin with a different outcome. */}
        {mode === "delete_all" ? (
          <p className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-300">
            If this creator has already been paid, their payout history is kept and their
            personal details are scrubbed instead — payout records can never be deleted.
          </p>
        ) : null}

        {error ? <p className="mt-4 text-center text-sm text-[var(--color-danger)]">{error}</p> : null}

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-[var(--color-danger)] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Removing…" : "Continue"}
          </button>
          <button
            onClick={onClose}
            className="min-h-11 cursor-pointer rounded-full border border-[var(--color-border)] px-5 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-text-muted)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
