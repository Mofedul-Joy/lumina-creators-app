"use client";

import { retryNonAuth } from "@/lib/api";
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
import { getCampaign, getSubmission, joinCampaign, submitClip, type Submission } from "@/lib/campaigns";
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
  const [trackStarted, setTrackStarted] = useState(0);
  // The verifying takeover must never become a permanent spinner — if the scrape
  // worker is down or wedged, stop waiting and report what we already know.
  const [waitedOut, setWaitedOut] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");
  const [gateOpen, setGateOpen] = useState(false);

  const q = useQuery({ queryKey: ["campaign", slug], queryFn: () => getCampaign(slug), enabled: hasToken, retry: retryNonAuth });

  const join = useMutation({
    mutationFn: () => joinCampaign(slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign", slug] }),
    onError: (e) => { if ((e as Error).message === "profile_incomplete") setGateOpen(true); },
  });
  const submit = useMutation({
    mutationFn: () => submitClip(slug, postUrl.trim()),
    onSuccess: (data) => { setPostUrl(""); setTrackId(data.id); setTrackStarted(Date.now()); },
  });
  // poll the freshly-submitted post until Apify finishes fetching its stats
  const track = useQuery({
    queryKey: ["track-sub", trackId],
    queryFn: () => getSubmission(trackId!),
    enabled: !!trackId,
    refetchInterval: (query) => {
      // No data yet (first fetch still in flight, or it errored before anything
      // was cached) — keep retrying rather than silently stopping, otherwise the
      // takeover below becomes a spinner with nothing driving it.
      const d = query.state.data;
      if (!d) return 4000;
      // Verified + still scraping → poll fast to surface stats. Awaiting review
      // → poll slower to catch the admin's approval. Otherwise stop.
      if (d.verification_status === "verified") return d.scrape_status === "pending" ? 4000 : false;
      if (d.verification_status === "rejected") return false;
      return 10000;
    },
  });
  useEffect(() => {
    if (!trackId) { setWaitedOut(false); return; }
    const id = setTimeout(() => setWaitedOut(true), Math.max(0, 45_000 - (Date.now() - trackStarted)));
    return () => clearTimeout(id);
  }, [trackId, trackStarted]);

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

  // Rhys 2026-07-21: submitting used to leave the creator on the campaign page
  // with a one-line status strip, so people wandered off mid-verify. The submit
  // now takes the screen over until it resolves, then reports in a modal.
  const t = track.data;
  const rejected = t?.verification_status === "rejected";
  const settledPost = !!t && (rejected || t.scrape_status !== "pending" || waitedOut);
  // `waitedOut` also releases the takeover when the submission never loaded at
  // all (repeated 5xx), so a backend blip can't trap the creator on the spinner.
  const verifying = !!trackId && !settledPost && !waitedOut;
  const closeTracker = () => { setTrackId(null); setWaitedOut(false); };

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
        ) : verifying ? (
          <VerifyingScreen campaign={c} platform={t?.platform} onBack={closeTracker} />
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
                {/* Rhys 2026-07-21: the brief used to be a grey footnote at the very
                    bottom ("External clip folder: open"). Creators need it up here.
                    2026-07-22: point it at the campaign's requirements doc. This was
                    wired to content_drive_url, which on seeded campaigns is a dead
                    placeholder, so the button rendered but went nowhere. The clip
                    folder is a fallback only. */}
                {(c.requirements_url || c.content_drive_url) ? (
                  <a
                    href={c.requirements_url || c.content_drive_url!}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 rounded-full border border-[var(--color-brand)]/50 bg-[var(--color-brand)]/10 px-3 py-1 text-[11px] font-medium text-[var(--color-brand)] transition hover:bg-[var(--color-brand)]/20"
                  >
                    View requirements ↗
                  </a>
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
                {/* Rhys 2026-07-21: "min. retention" meant nothing to creators. */}
                <Stat label="Campaign length" value={`${c.min_retention_days}d`} />
                {c.weekly_hours_needed ? <Stat label="Weekly hours" value={`${fmtInt(c.weekly_hours_needed)}/wk`} /> : null}
                {/* …and "Platforms: 2" told them less than the logos did. */}
                <Stat
                  label="Platforms"
                  value={
                    <span className="flex items-center gap-2 text-[var(--color-text)]">
                      {c.platforms.map((p) => (
                        <PlatformIcon key={p} name={p} className="h-5 w-5" aria-label={platformLabel(p)} />
                      ))}
                    </span>
                  }
                />
              </div>
            </div>

            {/* Targeting chips (platform chips now live in the stat tile above) */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
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

            {/* The old "External clip folder: open ↗" footnote is gone — the same
                URL is now the "View requirements" action in the header. */}

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
                    <p className="font-medium text-[var(--color-text)]">You don&apos;t have access to this campaign</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">An admin may have removed you from it. Reach out to the Lumina team if you think this is a mistake.</p>
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
                      {/* The old inline status strip lives on as the full-screen
                          VerifyingScreen + SubmissionResultModal below. */}
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
      <ProfileGateModal open={gateOpen} onClose={() => setGateOpen(false)} returnTo={`/campaigns/${slug}`} />
      {trackId && !verifying ? (
        t ? <SubmissionResultModal sub={t} onDone={closeTracker} />
          : <SubmissionStalledModal onDone={closeTracker} />
      ) : null}
      </main>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card-grad rounded-[var(--radius-btn)] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <div className="tabular text-lg font-semibold text-[var(--color-text)]">{value}</div>
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

// Rhys 2026-07-21: "if they click submit post, and it maybe redirects them the
// verification screen, it could be good … some players would just scroll around
// and click somewhere else." This is that screen — it owns the viewport while
// the post is being checked, with one deliberate way out.
function VerifyingScreen({ campaign, platform, onBack }: {
  campaign: { name: string; brand_name?: string | null; banner_url?: string | null };
  platform?: string;
  onBack: () => void;
}) {
  return (
    <div className="mt-6 flex min-h-[60vh] flex-col items-center justify-center text-center">
      {campaign.banner_url ? (
        <div className="mb-6 h-24 w-40 overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface-2)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={campaign.banner_url} alt="" className="h-full w-full object-cover opacity-70" />
        </div>
      ) : null}
      <span className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-brand)]/25 border-t-[var(--color-brand)]" />
      <h2 className="mt-6 text-xl font-semibold text-[var(--color-text)]">Verifying your post…</h2>
      <p className="mt-2 max-w-sm text-sm text-[var(--color-text-secondary)]">
        We&apos;re checking your {platform ? platformLabel(platform) : "post"} and pulling its stats.
        Hang tight — this usually takes a few seconds.
      </p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{campaign.brand_name ?? "Lumina campaign"} · {campaign.name}</p>
      <button
        onClick={onBack}
        className="mt-8 cursor-pointer text-xs text-[var(--color-text-muted)] underline transition hover:text-[var(--color-text)]"
      >
        Back to campaign
      </button>
    </div>
  );
}

// …"and then after it's done, they get the pop-up saying stats in, here's how
// much you're owed to be paid. They can click done, and it just redirects them
// back here."
function SubmissionResultModal({ sub, onDone }: { sub: Submission; onDone: () => void }) {
  const rejected = sub.verification_status === "rejected";
  const awaitingReview = !rejected && sub.verification_status !== "verified";
  // We may be here because we stopped waiting, not because the scrape finished —
  // in that case 0 views / $0 would be a lie, so say the stats are still coming.
  const statsPending = !rejected && sub.scrape_status === "pending";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
        <span
          className={`mx-auto grid h-12 w-12 place-items-center rounded-full text-2xl ${
            rejected ? "bg-[var(--color-danger)]/15" : "bg-[var(--color-brand)]/15"
          }`}
        >
          {rejected ? "✕" : "✓"}
        </span>
        <h2 className="mt-4 text-lg font-semibold text-[var(--color-text)]">
          {rejected ? "Not approved" : statsPending ? "Submitted" : awaitingReview ? "Submitted" : "Stats in"}
        </h2>

        {rejected ? (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {sub.verification_note || "This post wasn't approved for the campaign."}
          </p>
        ) : (
          <>
            {awaitingReview ? (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Your post is with our team for review. You&apos;ll be notified once it&apos;s approved.
              </p>
            ) : null}
            {statsPending ? (
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                We&apos;re still pulling its stats — they&apos;ll appear under Campaigns Entered shortly.
              </p>
            ) : awaitingReview ? (
              // Stats are in, but nothing is owed until an admin approves the
              // post — quoting a figure here would be a promise we can't keep.
              <div className="mt-4 grid grid-cols-1 gap-3">
                <div className="card-grad rounded-[var(--radius-btn)] px-3 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Views so far</p>
                  <p className="tabular text-lg font-semibold text-[var(--color-text)]">{fmtInt(sub.views)}</p>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Earnings are confirmed once your post is approved.
                </p>
              </div>
            ) : (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="card-grad rounded-[var(--radius-btn)] px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Views</p>
                <p className="tabular text-lg font-semibold text-[var(--color-text)]">{fmtInt(sub.views)}</p>
              </div>
              <div className="card-grad rounded-[var(--radius-btn)] px-3 py-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">You&apos;re owed</p>
                <p className="tabular text-lg font-semibold text-[var(--color-brand)]">{fmtMoney(sub.estimated_amount)}</p>
              </div>
            </div>
            )}
          </>
        )}

        <button
          onClick={onDone}
          className="mt-6 min-h-11 w-full cursor-pointer rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
        >
          {rejected ? "Try another link" : "Done"}
        </button>
      </div>
    </div>
  );
}

// The submission never loaded (repeated backend errors) and we stopped waiting.
// Say so honestly rather than implying the post failed to submit.
function SubmissionStalledModal({ onDone }: { onDone: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--color-surface-2)] text-2xl">⏳</span>
        <h2 className="mt-4 text-lg font-semibold text-[var(--color-text)]">Still working on it</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Your post was submitted, but we couldn&apos;t load its status just now. Check Campaigns Entered in a few minutes.
        </p>
        <button
          onClick={onDone}
          className="mt-6 min-h-11 w-full cursor-pointer rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
