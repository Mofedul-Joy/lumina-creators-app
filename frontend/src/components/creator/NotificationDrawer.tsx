"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { listNotifications, markNotificationsRead, type NotificationOut } from "@/lib/api";

/**
 * Right-side notification panel — mirrors the left sidebar but on the right.
 * The top-bar bell toggles it open/closed. Opening it marks everything read
 * (clears the badge); clicking a row routes to its `link` and closes the panel.
 */
function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const token = getAuthToken() ?? "";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(token),
    enabled: !!token && open,
    retry: false,
  });
  const notifications: NotificationOut[] = q.data ?? [];

  // Opening the panel = the creator has seen them → clear the unread badge.
  useEffect(() => {
    if (!open || !token) return;
    const hasUnread = (q.data ?? []).some((n) => !n.read);
    if (!hasUnread) return;
    markNotificationsRead(token)
      .then(() => {
        qc.invalidateQueries({ queryKey: ["notif-unread"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .catch(() => {});
  }, [open, token, q.data, qc]);

  function openNotification(n: NotificationOut) {
    onClose();
    if (n.link) router.push(n.link);
  }

  return (
    <>
      {/* backdrop — click to close */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      {/* right panel */}
      <aside
        role="dialog"
        aria-label="Notifications"
        className={`fixed right-0 top-0 z-50 flex h-[100dvh] w-[340px] max-w-[86vw] flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-deep)] shadow-2xl transition-transform duration-200 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)]/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <svg className="h-[18px] w-[18px] text-[var(--color-text)]" viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <h2 className="text-sm font-semibold text-[var(--color-text)]">Notifications</h2>
          </div>
          <button onClick={onClose} aria-label="Close notifications" className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {q.isLoading ? (
            <div className="space-y-2 px-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-[var(--color-surface)]/60" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <p className="text-sm font-medium text-[var(--color-text)]">You&apos;re all caught up</p>
              <p className="text-xs text-[var(--color-text-muted)]">Invites, updates on your submissions, views and payouts will show up here.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {notifications.map((n) => {
                const clickable = !!n.link;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => openNotification(n)}
                      disabled={!clickable}
                      className={`flex w-full gap-3 rounded-lg px-3 py-3 text-left transition ${clickable ? "cursor-pointer hover:bg-[var(--color-surface)]/60" : "cursor-default"}`}
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-[var(--color-brand)]"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--color-text)]">{n.title}</p>
                        {n.body ? <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{n.body}</p> : null}
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                          <span>{timeAgo(n.created_at)}</span>
                          {clickable ? <span className="text-[var(--color-brand-soft)]">· Tap to open</span> : null}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
