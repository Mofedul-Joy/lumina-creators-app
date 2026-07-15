"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CreatorSidebar } from "@/components/creator/CreatorSidebar";
import { CreatorTopbar } from "@/components/creator/CreatorTopbar";
import { NotificationDrawer } from "@/components/creator/NotificationDrawer";
import { MessagesDrawer } from "@/components/messaging/MessagesDrawer";
import { getAuthToken } from "@/lib/auth";
import { getProfile } from "@/lib/api";
import { retryNonAuth } from "@/lib/api";

// Shared shell for every authenticated creator page: a collapsible SideShift-
// style left rail (toggle to open/close on desktop; off-canvas drawer on mobile),
// a top bar with rank/streak chips + a notification bell, and a right-side
// notification drawer the bell toggles. Auth-gating stays per-page.
//
// Rhys rev4 — MANDATORY ONBOARDING: a creator whose profile isn't complete is
// locked into the onboarding flow. They can't reach any tab (no sidebar/topbar
// is even rendered) and any attempt to visit another route bounces them back to
// /onboarding, until they finish. Completed creators still open /onboarding as
// the "edit profile" surface WITH the normal chrome.
export function CreatorLayout({ children }: { children: React.ReactNode }) {
  const [mobileNav, setMobileNav] = useState(false); // mobile off-canvas drawer
  const [deskNav, setDeskNav] = useState(true);      // desktop rail open/closed
  const [notifOpen, setNotifOpen] = useState(false); // right notification drawer
  const [msgOpen, setMsgOpen] = useState(false);     // right messages drawer

  const pathname = usePathname();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { setToken(getAuthToken()); }, []);

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile(token ?? ""),
    enabled: !!token,
    retry: retryNonAuth,
    staleTime: 30_000,
  });
  const needsOnboarding = !!profileQ.data && !profileQ.data.completed;
  const onOnboarding = pathname === "/onboarding";

  // Force an incomplete creator into onboarding — keep any campaign they were
  // trying to reach as ?next so the wizard's finish step can send them there.
  useEffect(() => {
    if (needsOnboarding && !onOnboarding) {
      const next = pathname && pathname !== "/dashboard" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/onboarding${next}`);
    }
  }, [needsOnboarding, onOnboarding, pathname, router]);

  // Full-screen, chrome-free onboarding lock: no sidebar, no topbar, no drawers,
  // so there's literally nothing to click away to.
  if (onOnboarding && needsOnboarding) {
    return <div className="min-h-[100dvh]"><main className="min-w-0 flex-1">{children}</main></div>;
  }

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
