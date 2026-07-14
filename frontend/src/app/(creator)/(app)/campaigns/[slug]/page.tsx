"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { Markdown } from "@/components/ui/Markdown";
import { BonusMilestones } from "@/components/ui/BonusMilestones";
import { ExampleVideos } from "@/components/ui/ExampleVideos";
import { ProfileGateModal } from "@/components/creator/ProfileGateModal";
import { getAuthToken } from "@/lib/auth";
import { getCampaign, getSubmission, joinCampaign, submitClip } from "@/lib/campaigns";
import { fmtInt, fmtMoney } from "@/lib/format";
import { paymentHeadline, paymentTypeLabel, targetingChips } from "@/lib/campaignDisplay";

export default function CampaignDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const qc = useQueryClient();
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => setHasToken(!!getAuthToken()), []);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [postUrl, setPostUrl] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [trackId, setTrackId] = useState<string | null>(null);
  const [bulkMsg, setBulkMsg] = useState("");
  const [gateOpen, setGateOpen] = useState(false);

  const q = useQuery({ queryKey: ["campaign", slug], queryFn: () => getCampaign(slug), enabled: hasToken, retry: false });

  const join = useMutation({
    mutationFn: () => joinCampaign(slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign", slug] }),
    onError: (e) => { if ((e as Error).message === "profile_incomplete") setGateOpen(true); },
  });
  const submit = useMutation({
    mutationFn: () => submitClip(slug, postUrl.trim()),
    onSuccess: (data) => { setPostUrl(""); setTrackId(data.id); },
  });
  // poll the freshly-submitted post until Apify finishes fetching its stats
  const track = useQuery({
    queryKey: ["track-sub", trackId],
    queryFn: () => getSubmission(trackId!),
    enabled: !!trackId,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      // Verified + still scraping → poll fast to surface stats. Awaiting review
      // → poll slower to catch the admin's approval. Otherwise stop.
      if (d.verification_status === "verified") return d.scrape_status === "pending" ? 4000 : false;
      if (d.verification_status === "rejected") return false;
      return 10000;
    },
  });
  const bulkSubmit = useMutation({
    mutationFn: async () => {
      const urls = bulkText.split("\n").map((u) => u.trim()).filter(Boolean);
      let ok = 0, failed = 0;
      for (const u of urls) {
        try { await submitClip(slug, u); ok += 1; } catch { failed += 1; }
      }
      return { ok, failed, total: urls.length };
    },
    onSuccess: (r) => { setBulkText(""); setBulkMsg(`Submitted ${r.ok}/${r.total}. Stats are updating in the background.`); },
  });

  const c = q.data;
  const chips = c ? targetingChips(c) : [];
  // Only a legacy copy_paste campaign with no wizard fields still needs the
  // plain-text content_drive_url panel treated as the primary brief; every
  // other campaign gets the rich native brief.
  const isLegacyDriveOnly = c?.mode === "copy_paste" && !c?.payment_type && !c?.banner_url;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/campaigns" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
          ← All campaigns
        </Link>

        {!hasToken ? (
          <p className="mt-6 text-[var(--color-text-secondary)]">
            Please <Link href="/login" className="text-[var(--color-brand)] underline">sign in</Link> to view this campaign.
          </p>
        ) : q.isLoading ? (
          <p className="mt-6 text-[var(--color-text-muted)]">Loading…</p>
        ) : q.isError || !c ? (
          <p className="mt-6 text-[var(--color-danger)]">{(q.error as Error)?.message ?? "Campaign not found."}</p>
        ) : (
          <>
            {/* Banner hero */}
            {c.banner_url ? (
              <div className="relative mt-5 aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface-2)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.banner_url} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg-deep)] via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 p-5">
                  <p className="text-xs font-medium text-[var(--color-text-secondary)]">{c.brand_name ?? "Lumina campaign"}</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-text)] drop-shadow">{c.name}</h1>
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--color-text-secondary)]">{c.brand_name ?? "Lumina campaign"}</span>
                <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
                  {c.mode === "create_new" ? "Create new content" : "Repost approved clips"}
                </span>
                {c.job_type ? (
                  <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[11px] capitalize text-[var(--color-text-secondary)]">
                    {c.job_type.replace(/_/g, " ")}
                  </span>
                ) : null}
              </div>
              {!c.banner_url ? (
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-text)]">{c.name}</h1>
              ) : null}
              {c.description ? <p className="mt-2 text-[var(--color-text-secondary)]">{c.description}</p> : null}
            </div>

            {/* Payment & Terms */}
            <div className="mt-6 card-lumina rounded-[var(--radius-card)] p-5">
              <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                {paymentTypeLabel(c.payment_type)}
              </p>
              <p className="tabular mt-1 text-2xl font-semibold text-[var(--color-brand)]">
                {paymentHeadline(c)}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-4">
                <Stat label="Budget" value={fmtMoney(c.budget)} />
                <Stat label="Min. retention" value={`${c.min_retention_days}d`} />
                {c.weekly_hours_needed ? <Stat label="Weekly hours" value={`${fmtInt(c.weekly_hours_needed)}/wk`} /> : null}
                <Stat label="Platforms" value={String(c.platforms.length)} />
              </div>
            </div>

            {/* Platforms + targeting */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {c.platforms.map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-surface-2)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
                  <PlatformIcon name={p} className="h-3.5 w-3.5" />
                  {platformLabel(p)}
                </span>
              ))}
              {chips.map((chip) => (
                <span key={chip} className="inline-flex items-center rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
                  {chip}
                </span>
              ))}
            </div>

            {/* Native brief */}
            {c.brief_script ? (
              <Panel title="Your brief">
                <Markdown content={c.brief_script} />
              </Panel>
            ) : null}

            {isLegacyDriveOnly && c.content_drive_url ? (
              <Panel title="Approved clips">
                <p className="text-[var(--color-text-secondary)]">Download a clip from the campaign folder and post it to your socials.</p>
                <a href={c.content_drive_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[var(--color-brand)] underline">
                  Open clips folder ↗
                </a>
              </Panel>
            ) : null}

            {/* Bonus milestones */}
            {c.bonus_milestones && c.bonus_milestones.length > 0 ? (
              <Panel title="Bonus milestones">
                <BonusMilestones milestones={c.bonus_milestones} />
              </Panel>
            ) : null}

            {/* Example videos */}
            {(c.examples?.length || c.example_videos?.length) ? (
              <Panel title="Example videos">
                <ExampleVideos examples={c.examples} urls={c.example_videos} />
              </Panel>
            ) : null}

            {c.caption_rules ? (
              <Panel title="Caption rules">
                <Markdown content={c.caption_rules} />
              </Panel>
            ) : null}
            {c.required_mentions.length > 0 ? (
              <Panel title="Must mention">
                <p className="text-[var(--color-text-secondary)]">{c.required_mentions.join(", ")}</p>
              </Panel>
            ) : null}

            {/* Legacy Google-Doc-shaped fallback — demoted to a small link, not a hero panel */}
            {!isLegacyDriveOnly && c.content_drive_url ? (
              <p className="mt-4 text-xs text-[var(--color-text-muted)]">
                External clip folder:{" "}
                <a href={c.content_drive_url} target="_blank" rel="noreferrer" className="text-[var(--color-brand)] underline">
                  open ↗
                </a>
              </p>
            ) : null}

            {/* join / submit */}
            <div className="mt-8 card-grad rounded-[var(--radius-card)] p-6">
              {!c.joined ? (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-[var(--color-text-secondary)]">Enter this campaign to start submitting your posts.</p>
                  <div className="w-44">
                    <Button loading={join.isPending} onClick={() => join.mutate()}>Enter campaign</Button>
                  </div>
                  {join.isError && (join.error as Error).message !== "profile_incomplete" ? (
                    <p className="text-sm text-[var(--color-danger)]">{(join.error as Error).message}</p>
                  ) : null}
                </div>
              ) : !c.approved ? (
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l2.5 2.5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <div>
                    <p className="font-medium text-[var(--color-text)]">Request sent — pending admin approval</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">You&apos;ll be able to submit posts to this campaign once an admin approves you. We&apos;ll notify you.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--color-brand)]">You’re in this campaign.</p>
                    <div className="flex items-center gap-1 rounded-full bg-[var(--color-surface)] p-1">
                      {(["single", "bulk"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMode(m)}
                          className={`cursor-pointer rounded-full px-3 py-1 text-xs capitalize transition ${
                            mode === m ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                          }`}
                        >
                          {m === "single" ? "Single" : "Bulk"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {mode === "single" ? (
                    <>
                      <Field
                        label="Post URL"
                        placeholder="https://tiktok.com/@you/video/…"
                        value={postUrl}
                        onChange={(e) => setPostUrl(e.target.value)}
                      />
                      <div className="w-44">
                        <Button loading={submit.isPending} disabled={!postUrl.trim()} onClick={() => submit.mutate()}>
                          Submit post
                        </Button>
                      </div>
                      {submit.isError ? <p className="text-sm text-[var(--color-danger)]">{(submit.error as Error).message}</p> : null}

                      {/* live 'updating stats' tracker for the last submitted post */}
                      {trackId && track.data ? (
                        <div className="rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                          {track.data.verification_status === "rejected" ? (
                            <p className="text-sm text-[var(--color-danger)]">
                              Not approved for this campaign. Check My Campaigns for details.
                            </p>
                          ) : track.data.verification_status !== "verified" ? (
                            <p className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                              <span className="h-4 w-4 rounded-full border-2 border-[var(--color-text-muted)]/40 border-t-[var(--color-text-muted)]" />
                              Submitted — waiting for admin review. Stats start once it&apos;s approved.
                            </p>
                          ) : track.data.scrape_status === "pending" ? (
                            <p className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-brand)]/30 border-t-[var(--color-brand)]" />
                              Approved ✓ — fetching stats from {platformLabel(track.data.platform)}…
                            </p>
                          ) : (
                            <p className="text-sm text-[var(--color-brand)]">
                              Stats in ✓ — {fmtInt(track.data.views)} views · {fmtMoney(track.data.estimated_amount)} est.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-[var(--color-text)]">Post URLs (one per line)</label>
                      <textarea
                        rows={5}
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder={"https://tiktok.com/@you/video/1\nhttps://instagram.com/reel/abc"}
                        className="min-h-11 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus-visible:border-[var(--color-brand)]"
                      />
                      <div className="w-44">
                        <Button loading={bulkSubmit.isPending} disabled={!bulkText.trim()} onClick={() => { setBulkMsg(""); bulkSubmit.mutate(); }}>
                          Submit all
                        </Button>
                      </div>
                      {bulkMsg ? <p className="text-sm text-[var(--color-brand)]">{bulkMsg}</p> : null}
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      <ProfileGateModal open={gateOpen} onClose={() => setGateOpen(false)} />
      </main>
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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{title}</h2>
      <div className="card-grad rounded-[var(--radius-card)] p-5">{children}</div>
    </div>
  );
}
