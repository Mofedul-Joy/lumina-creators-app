"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Campaign } from "@/lib/campaigns";
import { fmtInt, fmtMoney } from "@/lib/format";
import { paymentHeadline, paymentTypeLabel, targetingChips } from "@/lib/campaignDisplay";
import { campaignTag, payBadge } from "@/lib/campaignTheme";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { Markdown } from "@/components/ui/Markdown";
import { ExampleVideos } from "@/components/ui/ExampleVideos";
import { BonusMilestones } from "@/components/ui/BonusMilestones";

// Campaign quick-look popup (SideShift-style): Overview + Payments tabs, example
// videos, and a sticky Apply-now bar. Apply routes into the campaign page where
// the actual join / submit flow lives — the modal itself never navigates.
export function CampaignModal({ campaign, onClose }: { campaign: Campaign | null; onClose: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "payments">("overview");
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Reset the tab only when a different campaign opens, and bind Escape once per
  // open — keying this on `onClose` (an inline arrow) would re-run on every
  // parent render and bounce the user off the Payments tab.
  const campaignId = campaign?.id ?? null;
  useEffect(() => {
    if (!campaignId) return;
    setTab("overview");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [campaignId]);

  if (!campaign) return null;
  const c = campaign;
  const chips = targetingChips(c);
  const apply = () => { onClose(); router.push(`/campaigns/${c.slug}`); };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh] backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={c.name}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        {/* header */}
        <div className="flex items-start gap-3 border-b border-[var(--color-border)] p-5">
          {c.brand_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.brand_logo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-sm text-[var(--color-text-muted)]">
              {(c.brand_name ?? c.name).charAt(0)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[var(--color-text-secondary)]">{c.brand_name ?? "Lumina campaign"}</p>
            <h2 className="mt-0.5 truncate text-lg font-semibold text-[var(--color-text)]">{c.name}</h2>
            <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
              {campaignTag(c)}
            </span>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* tabs */}
        <div className="flex shrink-0 border-b border-[var(--color-border)] px-5">
          {(["overview", "payments"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px cursor-pointer border-b-2 px-4 py-3 text-sm capitalize transition ${
                tab === t ? "border-[var(--color-brand)] font-medium text-[var(--color-text)]" : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === "overview" ? (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text)]">What you&apos;d be doing</h3>
                <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  {c.brief_script ? (
                    <Markdown content={c.brief_script} />
                  ) : c.description ? (
                    <p className="whitespace-pre-line">{c.description}</p>
                  ) : (
                    <p>Post content for {c.brand_name ?? "this brand"} on your socials and get paid on the views. Enter the campaign to see the full brief.</p>
                  )}
                </div>
              </div>

              {(c.examples?.length || c.example_videos?.length) ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Examples</h3>
                  <ExampleVideos examples={c.examples} urls={c.example_videos} />
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {c.platforms.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-surface-2)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
                    <PlatformIcon name={p} className="h-3.5 w-3.5" /> {platformLabel(p)}
                  </span>
                ))}
                {chips.map((chip) => (
                  <span key={chip} className="inline-flex items-center rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">{chip}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card-lumina rounded-[var(--radius-card)] p-4">
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{paymentTypeLabel(c.payment_type)}</p>
                <p className="tabular mt-1 text-2xl font-semibold text-[var(--color-brand)]">{paymentHeadline(c)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Budget" value={fmtMoney(c.budget)} />
                <Stat label="Min. retention" value={`${c.min_retention_days}d`} />
                {c.weekly_hours_needed ? <Stat label="Weekly hours" value={`${fmtInt(c.weekly_hours_needed)}/wk`} /> : null}
                <Stat label="Platforms" value={String(c.platforms.length)} />
              </div>
              {c.bonus_milestones && c.bonus_milestones.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Bonus milestones</h3>
                  <BonusMilestones milestones={c.bonus_milestones} />
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* sticky apply bar */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--color-border)] p-4">
          <div>
            <p className="tabular text-lg font-semibold text-[var(--color-text)]">{payBadge(c)}</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">{paymentTypeLabel(c.payment_type)}</p>
          </div>
          <button
            onClick={apply}
            className="min-h-11 cursor-pointer rounded-full bg-[var(--color-brand)] px-7 text-sm font-semibold text-[var(--color-on-brand)] shadow-[0_0_20px_-6px_rgba(34,197,94,0.8)] transition hover:bg-[var(--color-brand-hover)]"
          >
            {c.joined ? "View campaign" : "Apply now"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-grad rounded-[var(--radius-btn)] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="tabular text-lg font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}
