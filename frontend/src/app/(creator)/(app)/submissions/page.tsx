"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { browseCampaigns, claimSubmission, listSubmissions, uploadProofVideo } from "@/lib/campaigns";
import { ApiError } from "@/lib/api";
import { fmtInt, fmtMoney } from "@/lib/format";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { SkeletonCardGrid, SkeletonStats } from "@/components/ui/Skeleton";

const STATUS_STYLE: Record<string, string> = {
  approved: "border-[var(--color-brand)]/40 text-[var(--color-brand)]",
  pending: "border-[var(--color-border)] text-[var(--color-text-muted)]",
  rejected: "border-[var(--color-danger)]/40 text-[var(--color-danger)]",
};

function StatusPill({ label }: { label: string }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs capitalize ${
        STATUS_STYLE[label] ?? "border-[var(--color-border)] text-[var(--color-text-muted)]"
      }`}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}

export default function SubmissionsPage() {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => {
    setHasToken(!!getAuthToken());
    setReady(true);
  }, []);
  const enabled = ready && hasToken;

  const subsQ = useQuery({ queryKey: ["submissions"], queryFn: listSubmissions, enabled, retry: false });
  const campaignsQ = useQuery({ queryKey: ["campaigns"], queryFn: browseCampaigns, enabled, retry: false });

  const nameById = new Map((campaignsQ.data ?? []).map((c) => [c.id, c.name]));
  const modeById = new Map((campaignsQ.data ?? []).map((c) => [c.id, c.mode]));

  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [payoutGate, setPayoutGate] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const claimM = useMutation({
    mutationFn: (id: string) => claimSubmission(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["submissions"] }),
    onError: (err) => {
      // Backend returns 400 'no_payout_method' when nothing is on file — show
      // the set-your-method prompt instead of a raw error.
      if (err instanceof ApiError && err.message === "no_payout_method") setPayoutGate(true);
    },
  });
  const proofM = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadProofVideo(id, file, setUploadPct),
    onMutate: ({ id }) => { setUploadingId(id); setUploadPct(0); },
    onSettled: () => { setUploadingId(null); setUploadPct(0); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["submissions"] }),
  });

  if (ready && !hasToken)
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Please sign in</h1>
        <p className="text-[var(--color-text-secondary)]">Sign in to see your submissions.</p>
        <Link href="/login" className="text-[var(--color-brand)] underline">
          Go to sign in
        </Link>
      </main>
    );

  const subs = subsQ.data ?? [];
  const totals = subs.reduce(
    (acc, s) => ({
      views: acc.views + s.views,
      estimated: acc.estimated + Number(s.estimated_amount),
    }),
    { views: 0, estimated: 0 },
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Creator workspace</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">My submissions</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Every post you&apos;ve submitted, with live views and estimated earnings.
        </p>

        {subsQ.isLoading ? (
          <div className="mt-8 space-y-8">
            <SkeletonStats count={3} />
            <SkeletonCardGrid count={6} />
          </div>
        ) : subsQ.isError ? (
          <p className="mt-8 text-sm text-[var(--color-danger)]">{(subsQ.error as Error).message}</p>
        ) : subs.length === 0 ? (
          <div className="card-grad mt-8 rounded-[var(--radius-card)] border border-[var(--color-border)] p-10 text-center">
            <p className="text-lg font-medium text-[var(--color-text)]">No submissions yet</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Enter a campaign and submit a post to start earning on your views.
            </p>
            <Link
              href="/campaigns"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-btn)] bg-[var(--color-brand)] px-4 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
            >
              Browse campaigns
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="card-grad rounded-[var(--radius-card)] border border-[var(--color-border)] p-5">
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Submissions</p>
                <p className="tabular mt-2 text-2xl font-semibold text-[var(--color-text)]">{fmtInt(subs.length)}</p>
              </div>
              <div className="card-grad rounded-[var(--radius-card)] border border-[var(--color-border)] p-5">
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Total views</p>
                <p className="tabular mt-2 text-2xl font-semibold text-[var(--color-brand-soft)]">{fmtInt(totals.views)}</p>
              </div>
              <div className="card-grad rounded-[var(--radius-card)] border border-[var(--color-border)] p-5">
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Estimated earnings</p>
                <p className="tabular mt-2 text-2xl font-semibold text-[var(--color-text)]">{fmtMoney(totals.estimated)}</p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {subs.map((s) => {
                const needsProof = modeById.get(s.campaign_id) === "create_new";
                return (
                  <div key={s.id} className="card-lumina flex flex-col overflow-hidden rounded-[var(--radius-card)]">
                    <a
                      href={s.post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="relative block aspect-video w-full bg-gradient-to-br from-[var(--color-brand)]/20 to-[var(--color-bg-deep)] bg-cover bg-center"
                      style={s.thumbnail_url ? { backgroundImage: `url(${s.thumbnail_url})` } : undefined}
                    >
                      <span className="absolute inset-0 grid place-items-center">
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5Z" /></svg>
                        </span>
                      </span>
                      <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white">
                        <PlatformIcon name={s.platform} className="h-3.5 w-3.5" />
                      </span>
                    </a>
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium text-[var(--color-text)]">{nameById.get(s.campaign_id) ?? "Campaign"}</p>
                        <StatusPill label={s.verification_status} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="tabular text-[var(--color-text-secondary)]">{fmtInt(s.views)} views</span>
                        <span className="tabular font-medium text-[var(--color-text)]">{fmtMoney(s.estimated_amount)}</span>
                      </div>
                      {s.verification_status === "rejected" && s.verification_note ? (
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">{s.verification_note}</p>
                      ) : null}
                      {needsProof ? (
                        <div className="mt-3">
                          <input
                            ref={(el) => { fileInputs.current[s.id] = el; }}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) proofM.mutate({ id: s.id, file });
                              e.target.value = "";
                            }}
                          />
                          {uploadingId === s.id ? (
                            <div className="space-y-1.5">
                              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                                <div className="h-full rounded-full bg-[var(--color-brand)] transition-all" style={{ width: `${uploadPct}%` }} />
                              </div>
                              <p className="text-center text-[11px] text-[var(--color-text-muted)]">
                                {uploadPct < 100 ? `Uploading proof video... ${uploadPct}%` : "Finishing..."}
                              </p>
                            </div>
                          ) : s.has_proof_video ? (
                            <div className="flex items-center justify-between gap-2 rounded-md bg-[var(--color-brand)]/10 px-2.5 py-1.5">
                              <span className="text-xs font-medium text-[var(--color-brand)]">Proof uploaded ✓ · under review</span>
                              <button type="button" onClick={() => fileInputs.current[s.id]?.click()} className="cursor-pointer text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Replace</button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => fileInputs.current[s.id]?.click()}
                              className="w-full cursor-pointer rounded-md bg-amber-500/15 py-1.5 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/25 transition hover:bg-amber-500/25"
                            >
                              Upload proof video
                            </button>
                          )}
                        </div>
                      ) : null}

                      {/* claim payment — only once verified, not already claimed/paid */}
                      {s.is_paid ? (
                        <p className="mt-3 rounded-md bg-[var(--color-brand)]/10 py-1.5 text-center text-xs font-medium text-[var(--color-brand)]">Paid ✓</p>
                      ) : s.claimed ? (
                        <p className="mt-3 rounded-md bg-amber-500/15 py-1.5 text-center text-xs font-medium text-amber-400">Payment claimed · pending</p>
                      ) : s.verification_status === "verified" ? (
                        <button
                          type="button"
                          disabled={claimM.isPending}
                          onClick={() => claimM.mutate(s.id)}
                          className="mt-3 w-full cursor-pointer rounded-md bg-[var(--color-brand)] py-1.5 text-xs font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:opacity-50"
                        >
                          {claimM.isPending ? "Claiming..." : "Claim payment"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-[var(--color-text-muted)]">
              Views refresh automatically as Lumina tracks each post. Earnings are estimates until a campaign finalizes.
            </p>
          </>
        )}

        {/* payout-method gate: claim was blocked because no method is on file */}
        {payoutGate ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setPayoutGate(false)}>
            <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-[var(--color-text)]">Add a payout method first</h3>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Set where we should send your earnings before you can claim a payment.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <button onClick={() => setPayoutGate(false)} className="cursor-pointer rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Not now</button>
                <Link href="/onboarding?tab=payment" className="rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]">
                  Set payout method
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </main>
  );
}
