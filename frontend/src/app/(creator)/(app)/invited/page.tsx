"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { retryNonAuth } from "@/lib/api";
import { listInvitedCampaigns } from "@/lib/campaigns";
import { CampaignCard } from "@/components/campaign/CampaignCard";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";

// Rhys rev4: campaigns an admin personally invited this creator to. Rendered
// exactly like the Explore grid (same CampaignCard — thumbnail, brand, "Joined"
// badge, click-through to the campaign), but scoped to admin invites only.
export default function InvitedCampaignsPage() {
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => { setHasToken(!!getAuthToken()); }, []);

  const q = useQuery({
    queryKey: ["invited-campaigns"],
    queryFn: listInvitedCampaigns,
    enabled: hasToken,
    retry: retryNonAuth,
  });
  const campaigns = q.data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Lumina Creators</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Invited Campaigns</h1>
      <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
        Campaigns the Lumina team invited you to. Open one to review the brief and post.
      </p>

      <div className="mt-8">
        {q.isLoading ? (
          <SkeletonCardGrid count={3} />
        ) : q.isError ? (
          <div className="card-lumina rounded-[var(--radius-card)] p-10 text-center">
            <p className="text-lg font-medium text-[var(--color-text)]">Couldn&apos;t load your invites</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Something went wrong. Please try again.</p>
            <button
              onClick={() => q.refetch()}
              className="mt-4 rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
            >
              Try again
            </button>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="card-lumina rounded-[var(--radius-card)] p-10 text-center">
            <p className="text-lg font-medium text-[var(--color-text)]">No invites yet</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              When an admin invites you to a campaign, it shows up here. Meanwhile, browse{" "}
              <Link href="/campaigns" className="text-[var(--color-brand)] hover:underline">live campaigns</Link>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => <CampaignCard key={c.id} c={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}
