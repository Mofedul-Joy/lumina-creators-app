"use client";

import { useEffect, useRef, useState } from "react";
import type { Realm } from "@/lib/messaging";

/** Canned messages, curated per side. `{name}` is filled with the counterparty. */
function templatesFor(realm: Realm): { label: string; body: string }[] {
  if (realm === "admin") {
    return [
      { label: "Welcome to the campaign", body: "Hey {name}! Welcome aboard — we're excited to have you on this campaign. Shout if you have any questions getting started." },
      { label: "Content approved", body: "Your content's approved ✅ Great work! We'll get your payout moving shortly." },
      { label: "Revision requested", body: "Thanks for the submission! We'd love a small tweak before this goes live — the details are on your submission in the dashboard." },
      { label: "Payment sent", body: "Just sent your payment 💸 Let us know once it lands on your end." },
      { label: "Invite to a call", body: "Would love to hop on a quick call to align on the campaign — what time works for you this week?" },
    ];
  }
  return [
    { label: "Ask a question", body: "Hi team! Quick question about my campaign — " },
    { label: "My content is live", body: "My content just went live 🎉 Here's the link: " },
    { label: "Ask about payout", body: "Hi! When can I expect my payout for the last submission?" },
    { label: "Request more time", body: "Hey — could I get a little more time on the deadline? Here's why: " },
  ];
}

/**
 * Left-of-composer template button. Opens a small popover of canned messages;
 * picking one drops it into the draft.
 */
export function TemplatePicker({ realm, counterparty, onPick }: { realm: Realm; counterparty: string; onPick: (body: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const templates = templatesFor(realm);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        aria-label="Message templates" aria-expanded={open}
        className={`grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border transition ${open ? "border-[var(--color-brand)] text-[var(--color-brand)]" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2M9 3h6v3H9zM8 12h8M8 16h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open ? (
        <div className="absolute bottom-12 left-0 z-30 w-72 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-deep)] py-1 shadow-2xl">
          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Templates</p>
          {templates.map((t) => (
            <button
              key={t.label} type="button"
              onClick={() => { onPick(t.body.replaceAll("{name}", counterparty)); setOpen(false); }}
              className="block w-full px-3 py-2 text-left transition hover:bg-[var(--color-surface)]"
            >
              <span className="block text-sm font-medium text-[var(--color-text)]">{t.label}</span>
              <span className="mt-0.5 block truncate text-xs text-[var(--color-text-muted)]">{t.body.replaceAll("{name}", counterparty)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Admin-only "Actions" button in the thread header — quick jumps into the Lumina
 * flows that a conversation usually leads to (pay, review, invite).
 */
export function ActionsMenu({ creatorId }: { creatorId: string }) {
  const [open, setOpen] = useState(false);
  const actions = [
    { label: "Review profile & content", href: `/admin/creators/${creatorId}`, icon: "M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5C21.3 7.6 17 4.5 12 4.5Zm0 12a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Z" },
    { label: "Record a payment", href: `/admin/payments`, icon: "M2 7h20v10H2zM2 11h20M6 15h4" },
    { label: "Invite to a campaign", href: `/admin/campaigns`, icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6" },
  ];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Actions" aria-expanded={open}
        className={`cursor-pointer rounded-lg p-1.5 transition hover:bg-[var(--color-surface)] ${open ? "text-[var(--color-brand)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
        title="Actions"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open ? (
        <>
          <div aria-hidden className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-10 z-20 w-56 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-deep)] py-1 shadow-2xl">
            {actions.map((a) => (
              <a key={a.label} href={a.href} role="menuitem"
                 className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]">
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none"><path d={a.icon} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {a.label}
              </a>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
