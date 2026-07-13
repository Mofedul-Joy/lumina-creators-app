"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAdminToken } from "@/lib/auth";
import { unreadCount as getMsgUnread } from "@/lib/messaging";
import { MessagesDrawer } from "@/components/messaging/MessagesDrawer";

/**
 * The admin console has no top bar, so the Messages entry point is a floating
 * button pinned to the top-right corner (SideShift-style). It carries its own
 * unread badge and owns the drawer's open state.
 */
export function AdminMessagesLauncher() {
  const [open, setOpen] = useState(false);
  // Set when another page (e.g. Applicants "Message") asks us to open straight
  // to a specific creator's thread via the `lumina:open-messages` window event.
  const [initialConversationId, setInitialConversationId] = useState<string | null>(null);
  // The token only exists client-side (localStorage), so render nothing until
  // after mount — otherwise the server (no token → null) and client (button)
  // disagree and React throws a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<{ conversationId?: string }>).detail?.conversationId ?? null;
      setInitialConversationId(id);
      setOpen(true);
    };
    window.addEventListener("lumina:open-messages", onOpen);
    return () => window.removeEventListener("lumina:open-messages", onOpen);
  }, []);
  const token = getAdminToken() ?? "";
  const unread = useQuery({
    queryKey: ["conv-unread", "admin"],
    queryFn: () => getMsgUnread("admin"),
    enabled: !!token,
    retry: false,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  }).data?.unread ?? 0;

  if (!mounted || !token) return null;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Messages"
        aria-expanded={open}
        className={`fixed right-4 top-4 z-30 grid h-10 w-10 place-items-center rounded-full border shadow-lg transition lg:right-6 ${
          open
            ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-soft)]"
            : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-text-muted)]"
        }`}
      >
        <svg className="h-[19px] w-[19px]" viewBox="0 0 24 24" fill="none"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.9A8 8 0 1 1 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--color-brand)] px-1 text-[10px] font-bold leading-none text-[var(--color-on-brand)] ring-2 ring-[var(--color-bg-deep)]">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      <MessagesDrawer realm="admin" open={open} onClose={() => setOpen(false)} initialConversationId={initialConversationId} />
    </>
  );
}
