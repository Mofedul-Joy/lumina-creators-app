"use client";

import { CreatorSidebar } from "@/components/creator/CreatorSidebar";

// Shared shell for every authenticated creator page: sidenav (desktop) / top
// bar + bottom tabs (mobile), replacing the old flat CreatorNav each page used
// to render itself. Auth-gating stays per-page (each page already knows how
// to fetch with its own token) — this only supplies the chrome around it.
export function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col lg:flex-row">
      <CreatorSidebar />
      <main className="min-w-0 flex-1 pb-16 lg:pb-0">{children}</main>
    </div>
  );
}
