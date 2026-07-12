"use client";

import { useState } from "react";
import { CreatorSidebar } from "@/components/creator/CreatorSidebar";
import { CreatorTopbar } from "@/components/creator/CreatorTopbar";
import { NotificationDrawer } from "@/components/creator/NotificationDrawer";
import { MessagesDrawer } from "@/components/messaging/MessagesDrawer";

// Shared shell for every authenticated creator page: a collapsible SideShift-
// style left rail (toggle to open/close on desktop; off-canvas drawer on mobile),
// a top bar with rank/streak chips + a notification bell, and a right-side
// notification drawer the bell toggles. Auth-gating stays per-page.
export function CreatorLayout({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false); // mobile off-canvas drawer
  const [deskNav, setDeskNav] = useState(true);      // desktop rail open/closed
  const [notifOpen, setNotifOpen] = useState(false); // right notification drawer
  const [msgOpen, setMsgOpen] = useState(false);     // right messages drawer

  return (
    <div className="flex min-h-[100dvh]">
      <CreatorSidebar mobileOpen={mobileNav} deskOpen={deskNav} onClose={() => setMobileNav(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <CreatorTopbar
          onMenu={() => setMobileNav(true)}
          onToggleDesk={() => setDeskNav((v) => !v)}
          onBell={() => { setNotifOpen((v) => !v); setMsgOpen(false); }}
          notifOpen={notifOpen}
          onMessages={() => { setMsgOpen((v) => !v); setNotifOpen(false); }}
          msgOpen={msgOpen}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
      <MessagesDrawer realm="creator" open={msgOpen} onClose={() => setMsgOpen(false)} />
    </div>
  );
}
