"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { listInvitedCampaigns, retryNonAuth } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";

// Rhys rev4: campaigns an admin personally invited this creator to. Lives at
// /invited, linked from the "Invited Campaigns" sidebar item below My Campaigns.
export default function InvitedCampaignsPage() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { setToken(getAuthToken()); }, []);

  const q = useQuery({
    queryKey: ["invited-campaigns"],
    queryFn: () => listInvitedCampaigns(token ?? ""),
    enabled: !!token,
    retry: retryNonAuth,
  });
  const campaigns = q.data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Lumina Creators</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Invited Campaigns</h1>
      <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
        Campaigns the Lumina team invited you to. Open one to review the brief and join.
      </p>

      <div className="mt-8">
        {q.isLoading ? (
          <SkeletonCardGrid count={3} />
        ) : campaigns.length === 0 ? (
          <div className="card-lumina rounded-[var(--radius-card)] p-10 text-center">
            <p className="text-lg font-medium text-[var(--color-text)]">No invites yet</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              When an admin invites you to a campaign, it shows up here. Meanwhile, browse{" "}
              <Link href="/campaigns" className="text-[var(--color-brand)] hover:underline">live campaigns</Link>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <Link
                key={c.participation_id}
                href={`/campaigns/${c.slug}`}
                className="card-lumina card-interactive flex flex-col gap-3 rounded-[var(--radius-card)] p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-[var(--color-brand)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--color-brand)]">Invited</span>
                  <span className="tabular text-xs text-[var(--color-text-muted)]">{fmtMoney(c.cpm_rate)} / 1k</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--color-text)]">{c.name}</h2>
                  <p className="mt-0.5 truncate text-sm text-[var(--color-text-secondary)]">{c.brand_name ?? "Lumina campaign"}</p>
                </div>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brand)]">
                  View campaign
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
