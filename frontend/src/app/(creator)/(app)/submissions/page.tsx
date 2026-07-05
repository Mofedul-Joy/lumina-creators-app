"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreatorNav } from "@/components/creator/CreatorNav";
import { getAuthToken } from "@/lib/auth";
import { browseCampaigns, listSubmissions, uploadProofVideo } from "@/lib/campaigns";
import { fmtInt, fmtMoney } from "@/lib/format";

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
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const proofM = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadProofVideo(id, file),
    onMutate: ({ id }) => setUploadingId(id),
    onSettled: () => setUploadingId(null),
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
    <div className="min-h-[100dvh]">
      <CreatorNav />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Creator workspace</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">My submissions</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Every post you&apos;ve submitted, with live views and estimated earnings.
        </p>

        {subsQ.isLoading ? (
          <p className="mt-8 text-[var(--color-text-muted)]">Loading submissions…</p>
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

            <div className="card-lumina mt-8 overflow-hidden rounded-[var(--radius-card)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                      <th className="px-5 py-3 font-medium">Campaign</th>
                      <th className="px-5 py-3 font-medium">Post</th>
                      <th className="px-5 py-3 text-right font-medium">Views</th>
                      <th className="px-5 py-3 text-right font-medium">Est. earnings</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.map((s) => {
                      const needsProof = modeById.get(s.campaign_id) === "create_new";
                      return (
                      <tr key={s.id} className="border-t border-[var(--color-border)]">
                        <td className="px-5 py-3 text-[var(--color-text)]">
                          {nameById.get(s.campaign_id) ?? "Campaign"}
                        </td>
                        <td className="max-w-[260px] truncate px-5 py-3">
                          <a
                            href={s.post_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--color-brand)] hover:underline"
                          >
                            {s.platform} ↗
                          </a>
                        </td>
                        <td className="tabular px-5 py-3 text-right">{fmtInt(s.views)}</td>
                        <td className="tabular px-5 py-3 text-right">{fmtMoney(s.estimated_amount)}</td>
                        <td className="px-5 py-3">
                          <StatusPill label={s.verification_status} />
                          {s.verification_status === "rejected" && s.verification_note ? (
                            <p className="mt-1 max-w-[220px] text-xs text-[var(--color-text-muted)]">{s.verification_note}</p>
                          ) : null}
                        </td>
                        <td className="px-5 py-3">
                          {!needsProof ? (
                            <span className="text-xs text-[var(--color-text-muted)]">Not required</span>
                          ) : (
                            <>
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
                              <button
                                type="button"
                                disabled={uploadingId === s.id}
                                onClick={() => fileInputs.current[s.id]?.click()}
                                className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)] disabled:opacity-50"
                              >
                                {uploadingId === s.id
                                  ? "Uploading…"
                                  : s.has_proof_video
                                    ? "Replace video"
                                    : "Upload proof video"}
                              </button>
                              {s.has_proof_video && uploadingId !== s.id ? (
                                <span className="ml-2 text-xs text-[var(--color-brand)]">Uploaded ✓</span>
                              ) : null}
                            </>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
              Views refresh automatically as Lumina tracks each post. Earnings are estimates until a campaign finalizes.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
