"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  composeEmail, contractHistory, conversationInfo, listConversations, listMessages,
  markRead, sendMessage, setArchived, setMuted,
  type Conversation, type Realm,
} from "@/lib/messaging";
import { ConversationExtras } from "@/components/messaging/ConversationExtras";
import { ActionsMenu, TemplatePicker } from "@/components/messaging/ConversationActions";
import { ChannelBuilder } from "@/components/messaging/ChannelBuilder";

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
  const [tab, setTab] = useState<"all" | "dms" | "channels" | "unread">("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [building, setBuilding] = useState(false);  // admin: channel builder open
  // Three-dots menu + the slide-over sub-panels it (and the two-heads button) open.
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<null | "profile" | "info" | "contracts">(null);
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

  const muteM = useMutation({
    mutationFn: (muted: boolean) => setMuted(realm, activeId!, muted),
    onSuccess: () => { convsQ.refetch(); qc.invalidateQueries({ queryKey: ["conv-unread", realm] }); },
  });
  const archiveM = useMutation({
    mutationFn: (archived: boolean) => setArchived(activeId!, archived),
    onSuccess: () => { setActiveId(null); convsQ.refetch(); qc.invalidateQueries({ queryKey: ["conv-unread", realm] }); },
  });

  // Reset the menu + any open sub-panel whenever the active thread changes.
  useEffect(() => { setMenuOpen(false); setPanel(null); }, [activeId]);

  const filtered = conversations
    .filter((c) =>
      tab === "unread" ? c.unread : tab === "dms" ? c.kind === "dm" : tab === "channels" ? c.kind === "channel" : true)
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
              {realm === "admin" || conversations.length > 1 ? (
                <button onClick={() => setActiveId(null)} aria-label="Back" className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              ) : null}
              {active.kind === "channel" ? (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand-soft)]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1a4 4 0 0 0-3-3.87M16 4.13A4 4 0 0 1 16 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              ) : (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-sm font-semibold text-[var(--color-text-muted)]">{initials(active.name)}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--color-text)]">{active.kind === "channel" ? `# ${active.name}` : active.name}</p>
                {active.kind === "channel" ? (
                  <p className="truncate text-xs text-[var(--color-text-muted)]">{active.member_count ?? 0} member{active.member_count === 1 ? "" : "s"}</p>
                ) : active.email ? (
                  <p className="truncate text-xs text-[var(--color-text-muted)]">{active.email}</p>
                ) : null}
              </div>
              {/* two-heads — profile (DM) or member list (channel) */}
              <button
                onClick={() => { setPanel("profile"); setMenuOpen(false); }}
                aria-label={active.kind === "channel" ? "View members" : "View profile"}
                title={active.kind === "channel" ? "View members" : "View profile"}
                className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1a4 4 0 0 0-3-3.87M16 4.13A4 4 0 0 1 16 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {/* admin-only quick actions (pay / review / invite) — DMs only */}
              {realm === "admin" && active.kind === "dm" && active.creator_id ? <ActionsMenu creatorId={active.creator_id} /> : null}
              {/* email button — DM only (channels have no single address) */}
              {active.kind === "dm" ? (
                <button
                  onClick={() => composeEmail(active.email, "")}
                  disabled={!active.email}
                  title={active.email ? `Email ${active.email}` : "No email on file"}
                  aria-label="Send email"
                  className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-brand)] disabled:opacity-40"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M3 7l9 6 9-6M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              ) : null}
              {/* three-dots menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Conversation options"
                  aria-expanded={menuOpen}
                  className={`cursor-pointer rounded-lg p-1.5 transition hover:bg-[var(--color-surface)] ${menuOpen ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
                </button>
                {menuOpen ? (
                  <>
                    <div aria-hidden className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div role="menu" className="absolute right-0 top-10 z-20 w-56 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-deep)] py-1 shadow-2xl">
                      <button role="menuitem" onClick={() => { muteM.mutate(!active.muted); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]">
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />{active.muted ? <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : null}</svg>
                        {active.muted ? "Unmute notifications" : "Mute notifications"}
                      </button>
                      <button role="menuitem" onClick={() => { setPanel("info"); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]">
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none"><path d="M12 8h.01M11 12h1v4h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        Message history
                      </button>
                      {active.kind === "dm" ? (
                        <button role="menuitem" onClick={() => { setPanel("contracts"); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]">
                          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none"><path d="M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2M9 3h6v4H9zM9 12h6M9 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          Contract history
                        </button>
                      ) : null}
                      {realm === "admin" && active.kind === "dm" ? (
                        <button role="menuitem" onClick={() => { archiveM.mutate(true); setMenuOpen(false); }} className="flex w-full items-center gap-2.5 border-t border-[var(--color-border)]/60 px-3 py-2 text-left text-sm text-[var(--color-danger,#ef6a6a)] transition hover:bg-[var(--color-surface)]">
                          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          Leave conversation
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
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
                  // In a channel, label who said it (except your own messages).
                  const author = active.kind === "channel" && !mine ? m.sender_name : null;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "bg-[var(--color-surface)] text-[var(--color-text)]"}`}>
                        {author ? <p className="mb-0.5 text-[11px] font-semibold text-[var(--color-brand-soft)]">{author}</p> : null}
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
              <TemplatePicker
                realm={realm}
                counterparty={realm === "admin" ? active.name.split(" ")[0] : "team"}
                onPick={(body) => setDraft((d) => (d.trim() ? d.trimEnd() + "\n\n" + body : body))}
              />
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

            {/* two-heads / three-dots sub-panels slide over the thread */}
            {panel ? (
              <ConversationExtras
                realm={realm}
                conversation={active}
                panel={panel}
                onClose={() => setPanel(null)}
                onEmail={() => composeEmail(active.email, "")}
              />
            ) : null}
          </>
        ) : (
          /* ── list view ── */
          <>
            <div className="flex items-center justify-between border-b border-[var(--color-border)]/60 px-5 py-4">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">Messages</h2>
              <div className="flex items-center gap-1">
                {realm === "admin" ? (
                  <button onClick={() => setBuilding(true)} aria-label="New channel" title="New channel"
                          className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-brand)]">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  </button>
                ) : null}
                <button onClick={onClose} aria-label="Close messages" className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
            </div>
            <div className="border-b border-[var(--color-border)]/60 px-3 py-3">
              <input
                value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search messages…"
                className="mb-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus-visible:border-[var(--color-brand)]"
              />
              <div className="flex gap-1.5">
                {(["all", "dms", "channels", "unread"] as const).map((t) => (
                  <button
                    key={t} onClick={() => setTab(t)}
                    className={`cursor-pointer rounded-full px-3 py-1 text-xs transition ${tab === t ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
                  >
                    {t === "all" ? "All" : t === "dms" ? "DMs" : t === "channels" ? "Channels" : "Unread"}
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
                        {c.kind === "channel" ? (
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand-soft)]">
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 20v-1a4 4 0 0 0-3-3.87M16 4.13A4 4 0 0 1 16 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </span>
                        ) : (
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-sm font-semibold text-[var(--color-text-muted)]">{initials(c.name)}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className={`truncate text-sm ${c.unread ? "font-semibold text-[var(--color-text)]" : "font-medium text-[var(--color-text)]"}`}>{c.kind === "channel" ? `# ${c.name}` : c.name}</p>
                            <span className="flex shrink-0 items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                              {c.muted ? (
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-label="Muted"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              ) : null}
                              {timeAgo(c.last_message_at)}
                            </span>
                          </div>
                          <p className={`truncate text-xs ${c.unread ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]"}`}>
                            {c.last_sender === realm ? "You: " : ""}{c.last_message ?? "No messages yet"}
                          </p>
                        </div>
                        {c.unread && !c.muted ? <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-brand)]" /> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* admin channel builder slides over the list */}
            {building ? (
              <ChannelBuilder
                onClose={() => setBuilding(false)}
                onCreated={(c) => { setBuilding(false); convsQ.refetch(); setActiveId(c.id); }}
              />
            ) : null}
          </>
        )}
      </aside>
    </>
  );
}
