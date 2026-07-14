"use client";

import { retryNonAuth } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCampaignInviteLink,
  inviteToCampaign,
  listCreators,
  type CampaignInviteSummary,
  type CreatorRow,
} from "@/lib/admin";

/**
 * "Add creators" on the campaign detail page. Two ways to invite:
 *   - Existing creators — search the database, tick a few, Send → each gets a
 *     bell notification + email linking straight to the campaign.
 *   - By email / link — email outsiders a signup link that auto-joins them, or
 *     copy the reusable campaign invite link to share anywhere.
 */
type Tab = "existing" | "external";

function summaryLine(s: CampaignInviteSummary): string {
  const bits: string[] = [];
  if (s.invited_existing) bits.push(`${s.invited_existing} creator${s.invited_existing > 1 ? "s" : ""} invited`);
  if (s.invited_external) bits.push(`${s.invited_external} email${s.invited_external > 1 ? "s" : ""} sent`);
  if (!bits.length) bits.push("No new invites");
  if (s.skipped.length) bits.push(`${s.skipped.length} skipped (already active or invited)`);
  return bits.join(" · ");
}

export function AddCreatorsToCampaignModal({
  open,
  campaignId,
  onClose,
  onInvited,
}: {
  open: boolean;
  campaignId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("existing");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab("existing");
    setQ("");
    setSelected(new Set());
    setEmails("");
    setError(null);
    setResult(null);
    setLink(null);
    setCopied(false);
  }, [open]);

  const creatorsQ = useQuery({
    queryKey: ["invite-creators", q],
    queryFn: () => listCreators(q ? { q } : {}),
    enabled: open && tab === "existing",
    retry: retryNonAuth,
  });
  const creators: CreatorRow[] = creatorsQ.data ?? [];

  const emailList = useMemo(
    () => emails.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean),
    [emails],
  );

  if (!open) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    const creator_ids = tab === "existing" ? Array.from(selected) : [];
    const emailsToSend = tab === "external" ? emailList : [];
    if (!creator_ids.length && !emailsToSend.length) {
      setError(tab === "existing" ? "Select at least one creator." : "Enter at least one email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const s = await inviteToCampaign(campaignId, { creator_ids, emails: emailsToSend });
      setResult(summaryLine(s));
      setSelected(new Set());
      setEmails("");
      qc.invalidateQueries({ queryKey: ["campaign-overview", campaignId] });
      qc.invalidateQueries({ queryKey: ["campaign-invites", campaignId] });
      onInvited();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send invites.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      const l = link ?? (await getCampaignInviteLink(campaignId)).link;
      setLink(l);
      await navigator.clipboard.writeText(l);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get the invite link.");
    }
  }

  const TabBtn = ({ k, children }: { k: Tab; children: React.ReactNode }) => (
    <button
      onClick={() => { setTab(k); setError(null); setResult(null); }}
      className={`min-h-9 flex-1 cursor-pointer rounded-full px-4 text-sm transition ${
        tab === k ? "bg-[var(--color-surface-2)] font-medium text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="addcr-title">
      <div aria-hidden className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" />
      <div className="card-lumina relative flex max-h-[86vh] w-full max-w-lg flex-col rounded-[var(--radius-card)] p-6">
        <h2 id="addcr-title" className="text-xl font-semibold text-[var(--color-text)]">Invite creators</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Invited creators are added to this campaign right away — no application needed. They get a notification, a message, and an email, and can start submitting videos.
        </p>

        <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-[var(--color-surface)] p-1">
          <TabBtn k="existing">Existing creators</TabBtn>
          <TabBtn k="external">By email / link</TabBtn>
        </div>

        {tab === "existing" ? (
          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email…"
              className="min-h-10 w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
            />
            {creators.length ? (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">{selected.size} of {creators.length} selected</span>
                <button
                  type="button"
                  onClick={() => setSelected(selected.size === creators.length ? new Set() : new Set(creators.map((c) => c.id)))}
                  className="cursor-pointer font-medium text-[var(--color-brand-soft)] hover:underline"
                >
                  {selected.size === creators.length ? "Clear all" : "Select all"}
                </button>
              </div>
            ) : null}
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-xl border border-[var(--color-border)]">
              {creatorsQ.isLoading ? (
                <p className="p-4 text-sm text-[var(--color-text-muted)]">Loading…</p>
              ) : creators.length === 0 ? (
                <p className="p-4 text-sm text-[var(--color-text-muted)]">No creators found.</p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {creators.map((c) => {
                    const checked = selected.has(c.id);
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => toggle(c.id)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[var(--color-surface-2)]"
                        >
                          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${checked ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "border-[var(--color-border)]"}`}>
                            {checked ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-[var(--color-text)]">{c.display_name || c.email}</span>
                            <span className="block truncate text-xs text-[var(--color-text-muted)]">{c.email}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <label htmlFor="cr-emails" className="block text-sm text-[var(--color-text)]">Email addresses</label>
            <textarea
              id="cr-emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              rows={3}
              placeholder="creator@example.com, another@example.com"
              className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
            />
            <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
              Separate with commas or new lines. Each gets a signup link that auto-joins this campaign.
              {emailList.length ? ` (${emailList.length} address${emailList.length > 1 ? "es" : ""})` : ""}
            </p>

            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
              <p className="text-sm font-medium text-[var(--color-text)]">Shareable invite link</p>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">One reusable link — anyone who opens it can sign up and join.</p>
              <button
                onClick={copyLink}
                className="mt-3 inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-brand)]"
              >
                {copied ? "Link copied" : link ? "Copy link again" : "Copy invite link"}
              </button>
              {link ? <p className="mt-2 break-all text-xs text-[var(--color-text-muted)]">{link}</p> : null}
            </div>
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
        {result ? <p className="mt-3 text-sm text-[var(--color-brand-soft)]">{result}</p> : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-text-muted)]"
          >
            Done
          </button>
          <button
            onClick={send}
            disabled={busy}
            className="inline-flex min-h-10 cursor-pointer items-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Inviting…"
              : tab === "external" ? "Send invites"
              : selected.size > 1 && selected.size === creators.length ? "Invite all"
              : selected.size > 1 ? `Invite ${selected.size}`
              : "Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
