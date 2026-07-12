"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  composeEmail, listConversations, listMessages, markRead, sendMessage,
  type Conversation, type Realm,
} from "@/lib/messaging";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h`;
  return `${Math.floor(h / 24)}d`;
}

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

/**
 * Right-side Messages panel shared by the admin console and the creator app.
 * Two views in one drawer: the conversation list, and an open thread with a
 * composer + email button. Polls while open so replies appear without a reload.
 */
export function MessagesDrawer({ realm, open, onClose }: { realm: Realm; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (activeId ? setActiveId(null) : onClose());
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, activeId]);

  const convsQ = useQuery({
    queryKey: ["conversations", realm],
    queryFn: () => listConversations(realm),
    enabled: open,
    retry: false,
    refetchInterval: open ? 8000 : false,
  });
  const conversations = useMemo(() => convsQ.data ?? [], [convsQ.data]);

  // Creators have a single auto-created thread — open it straight away.
  useEffect(() => {
    if (open && realm === "creator" && !activeId && conversations.length === 1) {
      setActiveId(conversations[0].id);
    }
  }, [open, realm, activeId, conversations]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const msgsQ = useQuery({
    queryKey: ["messages", realm, activeId],
    queryFn: () => listMessages(realm, activeId!),
    enabled: open && !!activeId,
    retry: false,
    refetchInterval: open && activeId ? 5000 : false,
  });
  const messages = msgsQ.data ?? [];

  // Reading a thread clears its unread badge everywhere.
  useEffect(() => {
    if (activeId && msgsQ.isSuccess) {
      qc.invalidateQueries({ queryKey: ["conv-unread", realm] });
      qc.invalidateQueries({ queryKey: ["conversations", realm] });
    }
  }, [activeId, msgsQ.isSuccess, msgsQ.dataUpdatedAt, qc, realm]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, activeId]);

  const sendM = useMutation({
    mutationFn: (body: string) => sendMessage(realm, activeId!, body),
    onSuccess: () => {
      setDraft("");
      msgsQ.refetch();
      convsQ.refetch();
      qc.invalidateQueries({ queryKey: ["conv-unread", realm] });
    },
  });

  const filtered = conversations
    .filter((c) => (tab === "unread" ? c.unread : true))
    .filter((c) => (search ? c.name.toLowerCase().includes(search.toLowerCase()) || (c.email ?? "").toLowerCase().includes(search.toLowerCase()) : true));

  function openThread(c: Conversation) {
    setActiveId(c.id);
    if (c.unread) markRead(realm, c.id).then(() => {
      qc.invalidateQueries({ queryKey: ["conv-unread", realm] });
      qc.invalidateQueries({ queryKey: ["conversations", realm] });
    }).catch(() => {});
  }

  return (
    <>
      <div
        aria-hidden onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        role="dialog" aria-label="Messages"
        className={`fixed right-0 top-0 z-50 flex h-[100dvh] w-[380px] max-w-[92vw] flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-deep)] shadow-2xl transition-transform duration-200 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {active ? (
          /* ── thread view ── */
          <>
            <div className="flex items-center gap-2 border-b border-[var(--color-border)]/60 px-3 py-3">
              {realm === "admin" ? (
                <button onClick={() => setActiveId(null)} aria-label="Back" className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              ) : null}
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-sm font-semibold text-[var(--color-text-muted)]">{initials(active.name)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--color-text)]">{active.name}</p>
                {active.email ? <p className="truncate text-xs text-[var(--color-text-muted)]">{active.email}</p> : null}
              </div>
              {/* email button — opens Gmail compose to the other person */}
              <button
                onClick={() => composeEmail(active.email, "")}
                disabled={!active.email}
                title={active.email ? `Email ${active.email}` : "No email on file"}
                aria-label="Send email"
                className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-brand)] disabled:opacity-40"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M3 7l9 6 9-6M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <button onClick={onClose} aria-label="Close messages" className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
              {msgsQ.isLoading ? (
                <p className="text-center text-xs text-[var(--color-text-muted)]">Loading…</p>
              ) : messages.length === 0 ? (
                <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">No messages yet. Say hello 👋</p>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_type === realm;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "bg-[var(--color-surface)] text-[var(--color-text)]"}`}>
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`mt-0.5 text-[10px] ${mine ? "text-[var(--color-on-brand)]/70" : "text-[var(--color-text-muted)]"}`}>{timeAgo(m.created_at)}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); if (draft.trim()) sendM.mutate(draft.trim()); }}
              className="flex items-end gap-2 border-t border-[var(--color-border)]/60 p-3"
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (draft.trim()) sendM.mutate(draft.trim()); } }}
                rows={1}
                placeholder="Write a message…"
                className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus-visible:border-[var(--color-brand)]"
              />
              <button
                type="submit" disabled={!draft.trim() || sendM.isPending}
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-[var(--color-brand)] text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:opacity-40"
                aria-label="Send"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M4 12l16-8-6 16-3-6-7-2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </form>
          </>
        ) : (
          /* ── list view ── */
          <>
            <div className="flex items-center justify-between border-b border-[var(--color-border)]/60 px-5 py-4">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Messages</h2>
              <button onClick={onClose} aria-label="Close messages" className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="border-b border-[var(--color-border)]/60 px-3 py-3">
              <input
                value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search messages…"
                className="mb-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus-visible:border-[var(--color-brand)]"
              />
              <div className="flex gap-1.5">
                {(["all", "unread"] as const).map((t) => (
                  <button
                    key={t} onClick={() => setTab(t)}
                    className={`cursor-pointer rounded-full px-3 py-1 text-xs capitalize transition ${tab === t ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
                  >
                    {t === "all" ? "All" : "Unread"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {convsQ.isLoading ? (
                <p className="px-3 py-4 text-sm text-[var(--color-text-muted)]">Loading…</p>
              ) : filtered.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-surface)] text-2xl">💬</span>
                  <p className="text-sm font-medium text-[var(--color-text)]">No conversations{tab === "unread" ? " unread" : " yet"}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Messages with {realm === "admin" ? "creators" : "the Lumina team"} show up here.</p>
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {filtered.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => openThread(c)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[var(--color-surface)]/60"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-sm font-semibold text-[var(--color-text-muted)]">{initials(c.name)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className={`truncate text-sm ${c.unread ? "font-semibold text-[var(--color-text)]" : "font-medium text-[var(--color-text)]"}`}>{c.name}</p>
                            <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">{timeAgo(c.last_message_at)}</span>
                          </div>
                          <p className={`truncate text-xs ${c.unread ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]"}`}>
                            {c.last_sender === realm ? "You: " : ""}{c.last_message ?? "No messages yet"}
                          </p>
                        </div>
                        {c.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-brand)]" /> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
