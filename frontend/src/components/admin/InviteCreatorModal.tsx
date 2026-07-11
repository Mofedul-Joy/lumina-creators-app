"use client";

import { useEffect, useState } from "react";
import { createInvite, type CreatorInvite } from "@/lib/admin";

/**
 * Invite a creator two ways, from one popup:
 *   - type an email  → we send them an invitation
 *   - or just Create link → a shareable link the admin sends however they like
 * Either way the invitee signs up and lands in the normal onboarding flow.
 */
export function InviteCreatorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<CreatorInvite | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setError(null);
    setInvite(null);
    setCopied(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function send(withEmail: boolean) {
    setBusy(true);
    setError(null);
    try {
      setInvite(await createInvite(withEmail ? email.trim() : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the invite.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="invite-title">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" />
      <div className="card-lumina relative w-full max-w-md rounded-[var(--radius-card)] p-7">
        <h2 id="invite-title" className="text-xl font-semibold text-[var(--color-text)]">Invite a creator</h2>

        {!invite ? (
          <>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              Send an email invitation, or just create a link you can share with anyone.
              They&apos;ll sign up and go straight into onboarding.
            </p>

            <label htmlFor="invite-email" className="mt-5 block text-sm text-[var(--color-text)]">
              Email address
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && emailValid && !busy) send(true); }}
              autoFocus
              placeholder="creator@example.com"
              className="mt-2 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
            />

            {error ? <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p> : null}

            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={() => send(true)}
                disabled={!emailValid || busy}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Sending…" : "Send invitation"}
              </button>
              <button
                onClick={() => send(false)}
                disabled={busy}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-[var(--color-border)] px-5 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-brand)] disabled:opacity-60"
              >
                Create a shareable link instead
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                {invite.email
                  ? invite.email_sent
                    ? <>Invitation emailed to <span className="text-[var(--color-text)]">{invite.email}</span>.</>
                    : <>Invite created for <span className="text-[var(--color-text)]">{invite.email}</span>, but the email couldn&apos;t be sent. Share the link below instead.</>
                  : "Shareable invite link created."}
              </p>
            </div>

            <label className="mt-5 block text-sm text-[var(--color-text)]">Invite link</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                value={invite.link}
                onFocus={(e) => e.currentTarget.select()}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm text-[var(--color-text-secondary)] outline-none"
              />
              <button
                onClick={copy}
                className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-full border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-brand)]"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <button
              onClick={onClose}
              className="mt-6 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}
