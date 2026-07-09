"use client";

import { useState } from "react";
import { CreatorSidebar } from "@/components/creator/CreatorSidebar";
import { CreatorTopbar } from "@/components/creator/CreatorTopbar";

// Shared shell for every authenticated creator page: a persistent SideShift-
// style left rail (desktop) or hamburger drawer (mobile), plus a top bar with
// the rank/streak chips and notification bell. Auth-gating stays per-page.
export function CreatorLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-[100dvh]">
      <CreatorSidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <CreatorTopbar onMenu={() => setOpen(true)} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
