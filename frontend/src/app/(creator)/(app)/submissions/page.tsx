"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { browseCampaigns, claimSubmission, listSubmissions, resubmitClip, submitClip, uploadProofVideo, type Submission } from "@/lib/campaigns";
import { ApiError, listMyCampaigns, retryNonAuth} from "@/lib/api";
import { fmtInt, fmtMoney } from "@/lib/format";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { VideoThumb } from "@/components/ui/VideoThumb";
import { VideoModal } from "@/components/ui/VideoModal";

// Map a raw participation status to a creator-facing application tag.
function applicationTag(status: string): { label: string; cls: string } {
  switch (status) {
    case "approved":
    case "accepted":
      return { label: "Approved", cls: "bg-[var(--color-brand)]/15 text-[var(--color-brand)]" };
    case "submitted":
      return { label: "Submitted", cls: "bg-[var(--color-brand)]/15 text-[var(--color-brand)]" };
    case "reviewed":
    case "messaged":
    case "bookmarked":
      return { label: "Under review", cls: "bg-sky-500/15 text-sky-400" };
    case "declined":
    case "rejected":
      return { label: "Not selected", cls: "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]" };
    default: // "joined" — Rev2 auto-accepts on join, so joining IS being in the
             // campaign (no approval wait). Show it as an active/green state, not
             // an amber "Applied" pending tag.
      return { label: "Joined", cls: "bg-[var(--color-brand)]/15 text-[var(--color-brand)]" };
  }
}

// One row per campaign the creator has joined: total views generated and the
// money earned from it, plus how the payout looks. Deliberately simple.
type Group = {
  campaignId: string;
  name: string;
  brandLogo: string | null;
  posts: Submission[];
  views: number;
  earned: number;
  paid: number;
  claimableIds: string[];
  claimable: number;
  pendingClaim: number;
  needsProofIds: string[];
  slug: string | null;
  revisionPosts: Submission[];
};

function MyCampaignsInner() {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => {
    setHasToken(!!getAuthToken());
    setReady(true);
  }, []);
  const enabled = ready && hasToken;

  const subsQ = useQuery({ queryKey: ["submissions"], queryFn: listSubmissions, enabled, retry: retryNonAuth });
  const campaignsQ = useQuery({ queryKey: ["campaigns"], queryFn: browseCampaigns, enabled, retry: retryNonAuth });
  const appsQ = useQuery({ queryKey: ["my-applications"], queryFn: () => listMyCampaigns(getAuthToken() ?? ""), enabled, retry: retryNonAuth });

  const cById = new Map((campaignsQ.data ?? []).map((c) => [c.id, c]));

  const [payoutGate, setPayoutGate] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  // Minimum accumulated earnings before a payout can be requested (mirrors the
  // backend min_payout_amount default; backend is the authoritative gate).
  const MIN_PAYOUT = 5;
  const claimM = useMutation({
    mutationFn: async (ids: string[]) => { for (const id of ids) await claimSubmission(id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["submissions"] }),
    onError: (err) => { if (err instanceof ApiError && err.message === "no_payout_method") setPayoutGate(true); },
  });
  const proofM = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadProofVideo(id, file, setUploadPct),
    onMutate: ({ id }) => { setUploadingId(id); setUploadPct(0); },
    onSettled: () => { setUploadingId(null); setUploadPct(0); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["submissions"] }),
  });
  // Re-submitting a post the admin bounced back with an 'edit' revision.
  const [editUrls, setEditUrls] = useState<Record<string, string>>({});
  const [resubmitError, setResubmitError] = useState<Record<string, string>>({});
  const resubmitM = useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) => resubmitClip(id, url),
    onSuccess: (_r, { id }) => {
      setEditUrls((u) => { const n = { ...u }; delete n[id]; return n; });
      setResubmitError((e) => { const n = { ...e }; delete n[id]; return n; });
      qc.invalidateQueries({ queryKey: ["submissions"] });
    },
    onError: (err, { id }) => setResubmitError((e) => ({ ...e, [id]: err instanceof Error ? err.message : "Could not re-submit" })),
  });

  // Deep link from the bell notification and the review DM: /submissions?s=<id>.
  // Both are sent by admin_submissions._notify_creator when a video is bounced
  // back, so landing here must put the creator ON that video, not on a list they
  // have to search. Read it reactively: the drawers router.push() to this same
  // route, which does NOT remount the page, so a mount-only read would ignore
  // every click after the first.
  const focusId = useSearchParams().get("s");
  const revisionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const settledFor = useRef<string | null>(null);
  const [watching, setWatching] = useState<Submission | null>(null);

  useEffect(() => {
    if (!focusId || settledFor.current === focusId) return;
    // The target only exists once the submissions query has painted. This effect
    // re-runs as groups fill in, so bail quietly until then.
    if (!revisionRefs.current[focusId]) return;
    settledFor.current = focusId;

    let cancelled = false;
    // Never fight the creator: the moment they scroll themselves, we stop.
    const stop = () => { cancelled = true; };
    window.addEventListener("wheel", stop, { passive: true, once: true });
    window.addEventListener("touchmove", stop, { passive: true, once: true });

    const centre = () => {
      if (cancelled) return;
      const node = revisionRefs.current[focusId];
      if (!node) return;
      const r = node.getBoundingClientRect();
      // Only correct once it has actually drifted out of the comfortable band,
      // so a stable page doesn't get re-scrolled for no reason.
      if (r.top < 72 || r.bottom > window.innerHeight - 72) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    centre();
    // Every campaign card above this one carries a brand logo that loads AFTER
    // the first paint, and each one that lands pushes the target further down.
    // A single scrollIntoView therefore lands short on a creator with several
    // campaigns. Re-centre until the layout stops moving.
    const timers = [120, 350, 800, 1500, 2500].map((ms) => window.setTimeout(centre, ms));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchmove", stop);
    };
  }, [focusId, subsQ.data?.length, subsQ.isFetching]);

  // Submit ANOTHER video to a campaign the creator is already in — every joined
  // campaign supports more than one post (submissions are unique per-URL, not
  // per-creator). Inline per-campaign so they never leave this page.
  const [submitOpen, setSubmitOpen] = useState<Record<string, boolean>>({});
  const [submitDraft, setSubmitDraft] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<Record<string, string>>({});
  const submitM = useMutation({
    mutationFn: ({ slug, url }: { slug: string; url: string; key: string }) => submitClip(slug, url),
    onSuccess: (_r, { key }) => {
      setSubmitDraft((d) => ({ ...d, [key]: "" }));
      setSubmitError((e) => { const n = { ...e }; delete n[key]; return n; });
      setSubmitOpen((o) => ({ ...o, [key]: false }));
      qc.invalidateQueries({ queryKey: ["submissions"] });
    },
    onError: (err, { key }) => setSubmitError((e) => ({ ...e, [key]: err instanceof Error ? err.message : "Could not submit that video" })),
  });

  if (ready && !hasToken)
    return (
      <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Please sign in</h1>
        <p className="text-[var(--color-text-secondary)]">Sign in to see your campaigns.</p>
        <Link href="/login" className="text-[var(--color-brand)] underline">Go to sign in</Link>
      </main>
    );

  const subs = subsQ.data ?? [];

  // group submissions by campaign
  const groups: Group[] = [];
  const byId = new Map<string, Group>();
  for (const s of subs) {
    let g = byId.get(s.campaign_id);
    if (!g) {
      const c = cById.get(s.campaign_id);
      g = {
        campaignId: s.campaign_id,
        name: c?.name ?? "Campaign",
        brandLogo: c?.banner_url ?? c?.brand_logo_url ?? null,
        posts: [],
        views: 0,
        earned: 0,
        paid: 0,
        claimableIds: [],
        claimable: 0,
        pendingClaim: 0,
        needsProofIds: [],
        slug: c?.slug ?? null,
        revisionPosts: [],
      };
      byId.set(s.campaign_id, g);
      groups.push(g);
    }
    g.posts.push(s);
    if (s.verification_status === "revision_requested") g.revisionPosts.push(s);
    g.views += s.views;
    g.earned += Number(s.estimated_amount);
    if (s.is_paid) g.paid += Number(s.estimated_amount);
    else if (s.claimed) g.pendingClaim += Number(s.estimated_amount);
    else if (s.verification_status === "verified") { g.claimableIds.push(s.id); g.claimable += Number(s.estimated_amount); }
    if (cById.get(s.campaign_id)?.mode === "create_new" && !s.has_proof_video) g.needsProofIds.push(s.id);
  }
  groups.sort((a, b) => b.earned - a.earned);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">Campaigns Entered</h1>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Campaigns you&apos;ve joined — the views you&apos;ve generated and how your payout looks.
      </p>

      {subsQ.isLoading ? (
        <div className="mt-6"><SkeletonCardGrid count={3} /></div>
      ) : subsQ.isError ? (
        <p className="mt-6 text-sm text-[var(--color-danger)]">{(subsQ.error as Error).message}</p>
      ) : groups.length === 0 ? (
        <div className="mt-8 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
          <p className="text-lg font-medium text-[var(--color-text)]">No active campaigns yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-text-secondary)]">
            Join a campaign and post to your socials — it&apos;ll show up here with your views and earnings.
          </p>
          <Link href="/campaigns" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]">
            Explore campaigns
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {groups.map((g) => {
            const status =
              g.claimable > 0 ? { label: `Claimable ${fmtMoney(g.claimable)}`, cls: "text-[var(--color-brand)]" }
              : g.pendingClaim > 0 ? { label: "Payout pending", cls: "text-amber-400" }
              : g.paid > 0 ? { label: `Paid ${fmtMoney(g.paid)}`, cls: "text-[var(--color-brand)]" }
              : { label: "Tracking views", cls: "text-[var(--color-text-muted)]" };
            const firstProof = g.needsProofIds[0];
            return (
              <section key={g.campaignId} className="card-lumina rounded-[var(--radius-card)] p-5">
                <div className="flex items-center gap-3">
                  {g.brandLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.brandLogo} alt="" className="h-11 w-16 shrink-0 rounded-lg object-cover ring-1 ring-[var(--color-border)]" />
                  ) : (
                    <span className="grid h-11 w-16 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] text-base font-semibold text-[var(--color-text-muted)]">{g.name.charAt(0)}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--color-text)]">{g.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-[var(--color-text-muted)]">{g.posts.length} post{g.posts.length === 1 ? "" : "s"}</p>
                      {/* Badge so the creator can see at a glance a proof video landed. */}
                      {g.posts.some((p) => p.has_proof_video) ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--color-brand)]">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          Proof video uploaded
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold ${status.cls}`}>{status.label}</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[var(--color-surface-2)]/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Views generated</p>
                    <p className="tabular mt-1 text-xl font-semibold text-[var(--color-brand-soft)]">{fmtInt(g.views)}</p>
                  </div>
                  <div className="rounded-xl bg-[var(--color-surface-2)]/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Money earned</p>
                    <p className="tabular mt-1 text-xl font-semibold text-[var(--color-text)]">{fmtMoney(g.earned)}</p>
                  </div>
                </div>

                {/* A revision request is the one thing on this page the creator
                    MUST act on, and until now it was a small note that never said
                    which video it meant. Show the actual clip: thumbnail on the
                    left, the team's feedback and the resubmit control on the
                    right. `id` is the deep-link target for the bell + DM. */}
                {g.revisionPosts.map((p) => (
                  <div
                    key={p.id}
                    id={`sub-${p.id}`}
                    ref={(el) => { revisionRefs.current[p.id] = el; }}
                    className={`mt-4 scroll-mt-24 rounded-xl border bg-amber-500/5 p-4 transition ${
                      focusId === p.id
                        ? "border-amber-400 ring-2 ring-amber-400/60"
                        : "border-amber-500/30"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div className="w-full shrink-0 sm:w-40">
                        <VideoThumb
                          videoUrl={p.post_url}
                          thumbnailUrl={p.thumbnail_url}
                          platform={p.platform}
                          label="Needs changes"
                          onPlay={() => setWatching(p)}
                          className="aspect-[9/16] max-h-52 w-full rounded-lg sm:max-h-none"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-amber-400">
                          {p.revision_mode === "repost" ? "Post a new video" : "This video needs changes"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">{p.post_url}</p>

                        <div className="mt-3 rounded-lg bg-[var(--color-surface-2)]/70 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Feedback from the team</p>
                          {p.verification_note ? (
                            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text)]">{p.verification_note}</p>
                          ) : (
                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                              The team asked you to update this post. Open the messages tab if you need more detail.
                            </p>
                          )}
                        </div>

                        {p.revision_mode === "repost" ? (
                          <Link
                            href={g.slug ? `/campaigns/${g.slug}` : "/campaigns"}
                            className="mt-3 inline-flex min-h-10 items-center rounded-full bg-amber-500/15 px-5 text-sm font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/25 transition hover:bg-amber-500/25"
                          >
                            Post a new video
                          </Link>
                        ) : (
                          <div className="mt-3">
                            <label className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Updated post link</label>
                            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                              <input
                                value={editUrls[p.id] ?? p.post_url}
                                onChange={(e) => setEditUrls((u) => ({ ...u, [p.id]: e.target.value }))}
                                placeholder="Paste the link to your updated post…"
                                className="min-h-10 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)]"
                              />
                              <button
                                type="button"
                                disabled={resubmitM.isPending}
                                onClick={() => { setResubmitError((e) => { const n = { ...e }; delete n[p.id]; return n; }); resubmitM.mutate({ id: p.id, url: (editUrls[p.id] ?? p.post_url).trim() }); }}
                                className="min-h-10 shrink-0 cursor-pointer rounded-full bg-amber-500 px-6 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
                              >
                                {resubmitM.isPending ? "Sending…" : "Resubmit"}
                              </button>
                            </div>
                            {resubmitError[p.id] ? <p className="mt-1 text-xs text-[var(--color-danger)]">{resubmitError[p.id]}</p> : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {g.claimable > 0 ? (
                  g.claimable >= MIN_PAYOUT ? (
                    <button
                      type="button"
                      disabled={claimM.isPending}
                      onClick={() => claimM.mutate(g.claimableIds)}
                      className="mt-4 w-full cursor-pointer rounded-full bg-[var(--color-brand)] py-2 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:opacity-50"
                    >
                      {claimM.isPending ? "Claiming…" : `Claim ${fmtMoney(g.claimable)}`}
                    </button>
                  ) : (
                    <div className="mt-4">
                      <button type="button" disabled className="w-full cursor-not-allowed rounded-full bg-[var(--color-surface-2)] py-2 text-sm font-semibold text-[var(--color-text-muted)]">
                        Claim {fmtMoney(g.claimable)}
                      </button>
                      <p className="mt-1.5 text-center text-xs text-[var(--color-text-muted)]">
                        Earn {fmtMoney(MIN_PAYOUT - g.claimable)} more to request a payout (min {fmtMoney(MIN_PAYOUT)}).
                      </p>
                    </div>
                  )
                ) : firstProof ? (
                  <div className="mt-4">
                    <input
                      ref={(el) => { fileInputs.current[g.campaignId] = el; }}
                      type="file" accept="video/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) proofM.mutate({ id: firstProof, file: f }); e.target.value = ""; }}
                    />
                    {uploadingId === firstProof ? (
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                        <div className="h-full rounded-full bg-[var(--color-brand)] transition-all" style={{ width: `${uploadPct}%` }} />
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileInputs.current[g.campaignId]?.click()} className="w-full cursor-pointer rounded-full bg-amber-500/15 py-2 text-sm font-medium text-amber-400 ring-1 ring-inset ring-amber-500/25 transition hover:bg-amber-500/25">
                        Upload proof video to get paid
                      </button>
                    )}
                  </div>
                ) : null}

                {/* Submit another video — works for every joined campaign. */}
                {g.slug ? (
                  <div className="mt-4 border-t border-[var(--color-border)]/60 pt-4">
                    {submitOpen[g.campaignId] ? (
                      <div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            autoFocus
                            value={submitDraft[g.campaignId] ?? ""}
                            onChange={(e) => setSubmitDraft((d) => ({ ...d, [g.campaignId]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter" && (submitDraft[g.campaignId] ?? "").trim()) submitM.mutate({ slug: g.slug!, url: (submitDraft[g.campaignId] ?? "").trim(), key: g.campaignId }); }}
                            placeholder="Paste your new post link…"
                            className="min-h-9 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
                          />
                          <button
                            type="button"
                            disabled={submitM.isPending || !(submitDraft[g.campaignId] ?? "").trim()}
                            onClick={() => submitM.mutate({ slug: g.slug!, url: (submitDraft[g.campaignId] ?? "").trim(), key: g.campaignId })}
                            className="min-h-9 shrink-0 cursor-pointer rounded-full bg-[var(--color-brand)] px-4 text-xs font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:opacity-50"
                          >
                            {submitM.isPending ? "Submitting…" : "Submit"}
                          </button>
                          <button type="button" onClick={() => setSubmitOpen((o) => ({ ...o, [g.campaignId]: false }))} className="min-h-9 shrink-0 cursor-pointer rounded-full px-3 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Cancel</button>
                        </div>
                        {submitError[g.campaignId] ? <p className="mt-1 text-xs text-[var(--color-danger)]">{submitError[g.campaignId]}</p> : (
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Paste the link to a post you&apos;ve published for this campaign.</p>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSubmitOpen((o) => ({ ...o, [g.campaignId]: true }))}
                        className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[var(--color-border)] py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                        Submit another video
                      </button>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
          <p className="text-xs text-[var(--color-text-muted)]">
            Views refresh automatically as Lumina tracks each post. Earnings are estimates until a campaign finalizes.
          </p>
        </div>
      )}

      {/* Your applications — every campaign you applied to, with its status. */}
      {appsQ.data && appsQ.data.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text)]">Your applications</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Campaigns you&apos;ve applied to and where each stands.</p>
          <div className="mt-4 space-y-3">
            {appsQ.data.map((a) => {
              const tag = applicationTag(a.status);
              return (
                <Link
                  key={a.participation_id}
                  href={`/campaigns/${a.slug}`}
                  className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 transition hover:border-[var(--color-brand)]"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-2)] text-sm font-semibold text-[var(--color-text-muted)]">
                    {(a.brand_name || a.name).charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--color-text)]">{a.name}</p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                      {a.brand_name ? `${a.brand_name} · ` : ""}${Number(a.cpm_rate).toFixed(2)} / 1k views
                      {a.submission_count > 0 ? ` · ${a.submission_count} post${a.submission_count === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${tag.cls}`}>{tag.label}</span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* payout-method gate: claim blocked because no method is on file */}
      {payoutGate ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Add a payout method first</h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Set where we should send your earnings before you can claim a payment.</p>
            <div className="mt-5 flex justify-center gap-3">
              <button onClick={() => setPayoutGate(false)} className="cursor-pointer rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Not now</button>
              <Link href="/account" className="rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]">Set payout method</Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Play the clip that needs changes without leaving the page, so the
          creator can rewatch it against the feedback before resubmitting. */}
      {watching ? (
        <VideoModal
          url={watching.post_url}
          platform={watching.platform}
          thumbnailUrl={watching.thumbnail_url}
          onClose={() => setWatching(null)}
        />
      ) : null}
    </main>
  );
}

// useSearchParams needs a Suspense boundary for the build's static pass. The
// page itself is auth-gated and always client-rendered, so the fallback is
// never what a creator actually sees.
export default function MyCampaignsPage() {
  return (
    <Suspense fallback={null}>
      <MyCampaignsInner />
    </Suspense>
  );
}
