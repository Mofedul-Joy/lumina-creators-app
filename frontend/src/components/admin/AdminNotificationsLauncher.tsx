"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getAdminToken } from "@/lib/auth";
import { adminListNotifications, type AdminNotification } from "@/lib/admin";

const SEEN_KEY = "admin-notif-last-seen";

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function KindIcon({ kind }: { kind: AdminNotification["kind"] }) {
  const d = kind === "video_submission"
    ? "M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2zM10 9l5 3-5 3z"
    : "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M19 8v6M22 11h-6";
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/12 text-[var(--color-brand-soft)]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

/**
 * A simple activity bell for the admin console, pinned beside the messages
 * launcher. It shows a derived feed (videos to review, new applicants). "Unread"
 * is tracked client-side against the newest item the admin has already seen, so
 * there's no server write path to keep in sync.
 */
export function AdminNotificationsLauncher() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(0);

  useEffect(() => {
    setMounted(true);
    const raw = localStorage.getItem(SEEN_KEY);
    setLastSeen(raw ? Number(raw) : 0);
  }, []);

  const token = getAdminToken() ?? "";
  const items = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: adminListNotifications,
    enabled: !!token,
    retry: false,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  }).data ?? [];

  const unread = useMemo(
    () => items.filter((n) => new Date(n.created_at).getTime() > lastSeen).length,
    [items, lastSeen],
  );

  const markSeen = () => {
    const now = Date.now();
    localStorage.setItem(SEEN_KEY, String(now));
    setLastSeen(now);
  };
  const toggle = () => {
    setOpen((v) => {
      if (!v) markSeen(); // opening clears the badge
      return !v;
    });
  };

  if (!mounted || !token) return null;

  return (
    <>
      <button
        onClick={toggle}
        aria-label="Notifications"
        aria-expanded={open}
        className={`fixed top-4 z-30 grid h-10 w-10 place-items-center rounded-full border shadow-lg transition right-[64px] lg:right-[76px] ${
          open
            ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-soft)]"
            : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-text-muted)]"
        }`}
      >
        <svg className="h-[19px] w-[19px]" viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--color-brand)] px-1 text-[10px] font-bold leading-none text-[var(--color-on-brand)] ring-2 ring-[var(--color-bg-deep)]">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="fixed right-4 top-16 z-30 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl lg:right-6">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--color-text)]">Notifications</p>
              <span className="text-xs text-[var(--color-text-muted)]">{items.length}</span>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">You&apos;re all caught up.</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => { setOpen(false); router.push(n.link); }}
                    className="flex w-full items-start gap-3 border-b border-[var(--color-border)]/50 px-4 py-3 text-left transition last:border-0 hover:bg-[var(--color-surface-2)]"
                  >
                    <KindIcon kind={n.kind} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--color-text)]">{n.title}</p>
                      <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">{n.body}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">{ago(n.created_at)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
