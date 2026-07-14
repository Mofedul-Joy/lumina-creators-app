"use client";

import { retryNonAuth } from "@/lib/api";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Pager } from "@/components/admin/Pager";
import { SubmissionDetailModal } from "@/components/admin/SubmissionDetailModal";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { Select } from "@/components/ui/Select";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { SubmissionThumbnail } from "@/components/ui/SubmissionThumbnail";
import { listAdminCampaigns, listSubmissions, type AdminSubmission } from "@/lib/admin";
import { fmtInt, fmtMoney } from "@/lib/format";

const STATUSES = [
  { key: "", label: "All statuses" },
  { key: "awaiting_stats", label: "Awaiting stats" },
  { key: "proof_uploaded", label: "Proof uploaded" },
  { key: "stats_verified", label: "Stats verified" },
  { key: "payment_claimed", label: "Payment claimed" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
] as const;
const PLATFORMS = ["tiktok", "instagram", "youtube", "twitter", "facebook"] as const;
const PAGE = 6;

export function SubmissionsSection({ campaignId }: { campaignId?: string } = {}) {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [showFlagged, setShowFlagged] = useState(false);
  const [campaignFilter, setCampaignFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [detail, setDetail] = useState<AdminSubmission | null>(null);

  const campaignsQ = useQuery({
    queryKey: ["admin-campaigns-picker"],
    queryFn: () => listAdminCampaigns(),
    enabled: !campaignId,
  });

  const effectiveCampaignId = campaignId ?? (campaignFilter || undefined);
  const q = useQuery({
    queryKey: ["dash-submissions", effectiveCampaignId ?? "all", platformFilter, showFlagged],
    queryFn: () => listSubmissions({
      campaign_id: effectiveCampaignId,
      platform: platformFilter || undefined,
      suspicious: showFlagged || undefined,
    }),
    retry: retryNonAuth,
  });

  const all = q.data ?? [];
  const filtered = useMemo(() => (status ? all.filter((s) => s.status === status) : all), [all, status]);
  const thumbPool = useMemo(() => all.map((s) => s.thumbnail_url).filter(Boolean) as string[], [all]);
  const pageCount = Math.ceil(filtered.length / PAGE);
  const rows = filtered.slice((page - 1) * PAGE, page * PAGE);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Submissions</h2>
        <div className="flex flex-wrap items-center gap-2">
          {!campaignId ? (
            <Select
              className="w-48"
              value={campaignFilter}
              onChange={(v) => { setCampaignFilter(v); setPage(1); }}
              options={[
                { value: "", label: "All campaigns" },
                ...(campaignsQ.data ?? []).map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          ) : null}
          <Select
            className="w-44"
            value={platformFilter}
            onChange={(v) => { setPlatformFilter(v); setPage(1); }}
            options={[
              { value: "", label: "All platforms" },
              ...PLATFORMS.map((p) => ({ value: p, label: platformLabel(p) })),
            ]}
          />
          <button
            onClick={() => { setShowFlagged((v) => !v); setPage(1); }}
            className={`min-h-9 cursor-pointer rounded-full px-3 text-sm transition ${showFlagged ? "bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/25" : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
          >
            {showFlagged ? "Showing flagged" : "Show flagged"}
          </button>
          <Select
            className="w-44"
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={STATUSES.map((s) => ({ value: s.key, label: s.label }))}
          />
        </div>
      </div>

      {q.isLoading ? (
        <SkeletonCardGrid count={6} />
      ) : filtered.length === 0 ? (
        <div className="card-lumina rounded-[var(--radius-card)] p-10 text-center text-sm text-[var(--color-text-secondary)]">No submissions in this view.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setDetail(s)}
                className="card-lumina card-interactive flex flex-col overflow-hidden rounded-[var(--radius-card)] text-left"
              >
                <SubmissionThumbnail
                  thumbnailUrl={s.thumbnail_url}
                  postUrl={s.post_url}
                  platform={s.platform}
                  pool={thumbPool}
                  className="aspect-video w-full"
                >
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5Z" /></svg>
                    </span>
                  </span>
                  <span className="absolute left-2 top-2"><StatusBadge status={s.status} /></span>
                  <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white">
                    <PlatformIcon name={s.platform} className="h-3.5 w-3.5" />
                  </span>
                  {s.post_unavailable ? (
                    <span className="absolute bottom-2 left-2 rounded-full bg-red-500/80 px-2 py-0.5 text-[10px] font-medium text-white">Post unavailable</span>
                  ) : null}
                </SubmissionThumbnail>
                {/* bottom detail section — solid surface for legibility against
                    the atmospheric background (was low-contrast before) */}
                <div className="flex flex-1 flex-col gap-2 bg-[var(--color-surface-2)] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--color-text)]">{s.creator_name ?? "Unnamed"}</p>
                    {(s.is_suspicious || s.creator_is_suspicious) ? (
                      <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                        {s.is_suspicious ? "Suspicious" : "Creator flagged"}
                      </span>
                    ) : s.claimed && s.status !== "paid" ? (
                      <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">Claimed</span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-[var(--color-text-muted)]">{s.campaign_name}</p>
                  <div className="mt-1 flex items-center justify-between border-t border-[var(--color-border)] pt-2">
                    <span className="tabular text-sm text-[var(--color-text-secondary)]">{fmtInt(s.views)} views</span>
                    <span className="tabular text-sm font-semibold text-[var(--color-brand-soft)]">{fmtMoney(s.estimated_amount)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <Pager page={page} pageCount={pageCount} onPage={setPage} total={filtered.length} />
        </>
      )}

      {detail ? <SubmissionDetailModal sub={detail} pool={thumbPool} onClose={() => setDetail(null)} /> : null}
    </div>
  );
}
