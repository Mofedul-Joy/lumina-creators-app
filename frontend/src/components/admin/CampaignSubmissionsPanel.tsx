"use client";

// Per-campaign submissions panel for the admin dashboard. Pick one of the
// campaigns currently running in the app to see that campaign's own details and
// every video submitted to it.
//
// This replaces the earlier per-client ("Client submissions") panel, which is
// parked unmerged on the `client-submission-on-admin-dashboard` branch. Admins
// think in campaigns, not brands, and a campaign is the unit that actually has
// a budget, a CPM and a set of videos attached to it.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { retryNonAuth } from "@/lib/api";
import { listAdminCampaigns, listSubmissions } from "@/lib/admin";
import { SubmissionsSection } from "@/components/admin/SubmissionsSection";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { Select } from "@/components/ui/Select";
import { fmtInt, fmtMoney } from "@/lib/format";

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card-grad rounded-[var(--radius-card)] p-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
      <p className={`tabular mt-3 text-2xl font-semibold ${accent ? "text-[var(--color-brand-soft)]" : "text-[var(--color-text)]"}`}>{value}</p>
    </div>
  );
}

export function CampaignSubmissionsPanel() {
  const [campaignId, setCampaignId] = useState("");

  const campaignsQ = useQuery({
    queryKey: ["admin-campaigns-dashboard-picker"],
    queryFn: () => listAdminCampaigns(),
    retry: retryNonAuth,
  });

  // Only what's actually running: archived and draft campaigns are noise in a
  // dashboard picker. Alphabetical, like every other picker in the admin.
  const campaigns = useMemo(
    () => (campaignsQ.data ?? [])
      .filter((c) => c.status === "active")
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [campaignsQ.data],
  );
  const selected = campaigns.find((c) => c.id === campaignId);

  // Campaign-level totals. The submissions grid below fetches its own page of
  // rows; this pulls the full set once so the tiles count every video, not just
  // the visible page.
  const statsQ = useQuery({
    queryKey: ["campaign-panel-stats", campaignId],
    queryFn: () => listSubmissions({ campaign_id: campaignId, limit: 500 }),
    enabled: !!campaignId,
    retry: retryNonAuth,
  });
  const subs = statsQ.data ?? [];
  const totalViews = subs.reduce((n, s) => n + (Number(s.views) || 0), 0);
  const verified = subs.filter((s) => s.verification_status === "verified").length;

  return (
    <section className="mt-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand)]">Per-campaign view</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Campaign submissions</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Pick a campaign to see its details and every video submitted to it.
          </p>
        </div>
        <Select
          value={campaignId}
          onChange={setCampaignId}
          options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
          placeholder={campaignsQ.isLoading ? "Loading campaigns…" : "Select a campaign"}
          ariaLabel="Select a campaign"
          className="min-w-56"
        />
      </div>

      {!campaignId ? (
        <div className="mt-5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]/40 px-6 py-10 text-center text-sm text-[var(--color-text-muted)]">
          {campaigns.length === 0 && !campaignsQ.isLoading
            ? "No active campaigns yet."
            : "Select a campaign above to view its details and submissions."}
        </div>
      ) : (
        <div className="mt-5">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold text-[var(--color-text)]">{selected.name}</span>
                {selected.brand_name ? (
                  <span className="text-sm text-[var(--color-text-secondary)]">{selected.brand_name}</span>
                ) : null}
                <span className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-[11px] capitalize text-[var(--color-text-secondary)]">
                  {selected.mode === "copy_paste" ? "Repost approved clips" : "Create new content"}
                </span>
                {selected.platforms.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 rounded-md bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
                    <PlatformIcon name={p} className="h-3 w-3" />
                    {platformLabel(p)}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatTile label="Videos" value={fmtInt(subs.length)} />
                <StatTile label="Views" value={fmtInt(totalViews)} accent />
                <StatTile label="Verified" value={fmtInt(verified)} />
                <StatTile label="Spent" value={fmtMoney(Number(selected.spent_amount))} />
                <StatTile label="Budget" value={fmtMoney(Number(selected.budget))} />
              </div>
            </>
          ) : null}

          {/* Reuses the same grid the campaign page uses, scoped to this
              campaign, so a video opens in the existing detail modal. */}
          <div className="mt-6">
            <SubmissionsSection campaignId={campaignId} />
          </div>
        </div>
      )}
    </section>
  );
}

export default CampaignSubmissionsPanel;
