"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PlatformIcon } from "@/components/ui/PlatformIcon";
import { Select } from "@/components/ui/Select";
import {
  deleteSubmission, logSubmissionPayout, rejectSubmission, requestSubmissionRevision, verifySubmission,
  type AdminSubmission, type PayoutMethod,
} from "@/lib/admin";
import { flagCreatorSuspicious, unflagCreatorSuspicious } from "@/lib/api";
import { getAdminToken } from "@/lib/auth";
import { fmtInt, fmtMoney } from "@/lib/format";
import { SocialEmbed } from "@/components/admin/SocialEmbed";

const METHODS: PayoutMethod[] = ["paypal", "solana", "whop"];
const METHOD_LABEL: Record<string, string> = { paypal: "PayPal", solana: "Solana", whop: "Whop" };

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[var(--radius-btn)] bg-[var(--color-surface-2)] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className={`tabular text-lg font-semibold ${accent ? "text-[var(--color-brand-soft)]" : "text-[var(--color-text)]"}`}>{value}</p>
    </div>
  );
}

// Minimal admin submission detail — key stats + verification + the admin
// control set (Accept / Reject / Log payout / Suspend user / Delete). No
// bot-detection or other clippers-only chrome.
export function SubmissionDetailModal({ sub, onClose, pool }: { sub: AdminSubmission; onClose: () => void; pool?: string[] }) {
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [revising, setRevising] = useState<null | "edit" | "repost">(null);
  const [note, setNote] = useState("");
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<PayoutMethod>("paypal");
  const [reference, setReference] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setMounted(true), []);

  const done = () => { qc.invalidateQueries({ queryKey: ["dash-submissions"] }); onClose(); };
  const refetchStay = () => qc.invalidateQueries({ queryKey: ["dash-submissions"] });
  const fail = (e: unknown) => setError((e as Error).message);

  const verifyM = useMutation({ mutationFn: () => verifySubmission(sub.id), onSuccess: done, onError: fail });
  const rejectM = useMutation({ mutationFn: () => rejectSubmission(sub.id, note.trim()), onSuccess: done, onError: fail });
  const reviseM = useMutation({ mutationFn: () => requestSubmissionRevision(sub.id, revising ?? "edit", note.trim()), onSuccess: done, onError: fail });
  const payM = useMutation({ mutationFn: () => logSubmissionPayout(sub.id, method, reference), onSuccess: done, onError: fail });
  const deleteM = useMutation({ mutationFn: () => deleteSubmission(sub.id), onSuccess: done, onError: fail });
  const flagCreatorM = useMutation({
    mutationFn: () => (sub.creator_is_suspicious
      ? unflagCreatorSuspicious(getAdminToken() ?? "", sub.creator_id)
      : flagCreatorSuspicious(getAdminToken() ?? "", sub.creator_id)),
    onSuccess: refetchStay, onError: fail,
  });

  const isPaid = sub.status === "paid";
  // Approval is a visual review of the post itself (watched inline below), not
  // a separate proof-video upload — so Verify is available whenever the post
  // isn't already paid out. Backend enforces the real rules.
  const canVerify = !isPaid;

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4">
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]">
              <PlatformIcon name={sub.platform} className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">{sub.creator_name ?? "Unnamed"}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{sub.campaign_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={sub.status} />
            <button onClick={onClose} className="cursor-pointer rounded-full p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Watch the post inline on Lumina; link-out fallback for broken embeds. */}
          <SocialEmbed
            platform={sub.platform}
            postUrl={sub.post_url}
            thumbnailUrl={sub.thumbnail_url}
            embedBroken={sub.embed_broken}
            pool={pool}
          />

          {/* stats */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            <Stat label="Views" value={fmtInt(sub.views)} />
            <Stat label="Likes" value={fmtInt(sub.likes)} />
            <Stat label="Comments" value={fmtInt(sub.comments)} />
            <Stat label="Est." value={fmtMoney(sub.estimated_amount)} accent />
          </div>

          {/* verification */}
          <div className="mt-4 flex items-center justify-between rounded-[var(--radius-btn)] bg-[var(--color-surface-2)] px-3 py-2 text-sm">
            <span className="text-[var(--color-text-muted)]">Verification</span>
            <span className="capitalize text-[var(--color-text)]">{sub.verification_status}</span>
          </div>
          {sub.proof_url ? (
            <a
              href={sub.proof_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-2 rounded-[var(--radius-btn)] bg-[var(--color-brand)]/12 py-2 text-sm font-medium text-[var(--color-brand-soft)] transition hover:bg-[var(--color-brand)]/20"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5Z" /></svg>
              View optional proof video
            </a>
          ) : null}
          {sub.verification_note ? (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">Note: {sub.verification_note}</p>
          ) : null}

          {error ? <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}

          {/* reject sub-form */}
          {rejecting ? (
            <div className="mt-4 space-y-2">
              <textarea
                value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                placeholder="Reason (shown to the creator)..."
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-text)]"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setRejecting(false); setNote(""); }} className="cursor-pointer text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Cancel</button>
                <button disabled={!note.trim() || rejectM.isPending} onClick={() => { setError(""); rejectM.mutate(); }}
                  className="cursor-pointer rounded-md bg-red-500/15 px-3 py-1 text-xs font-medium text-red-400 ring-1 ring-inset ring-red-500/25 disabled:opacity-50">Confirm reject</button>
              </div>
            </div>
          ) : revising ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-[var(--color-text-secondary)]">
                {revising === "edit"
                  ? "Send back so the creator can fix and re-submit this same post."
                  : "Send back and ask the creator to post a brand-new video."}
              </p>
              <textarea
                value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                placeholder="What needs changing? (optional — shown to the creator)"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1.5 text-sm text-[var(--color-text)]"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setRevising(null); setNote(""); }} className="cursor-pointer text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Cancel</button>
                <button disabled={reviseM.isPending} onClick={() => { setError(""); reviseM.mutate(); }}
                  className="cursor-pointer rounded-md bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/25 disabled:opacity-50">
                  {revising === "edit" ? "Send back to edit" : "Ask for new post"}
                </button>
              </div>
            </div>
          ) : paying ? (
            <div className="mt-4 space-y-2 rounded-[var(--radius-btn)] bg-[var(--color-surface-2)] p-3">
              <p className="text-sm font-medium text-[var(--color-text)]">Log payout of {fmtMoney(sub.estimated_amount)}</p>
              <div className="grid grid-cols-2 gap-2">
                <Select value={method} onChange={(v) => setMethod(v as PayoutMethod)}
                  options={METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))} />
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Reference (optional)"
                  className="min-h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text)]" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setPaying(false)} className="cursor-pointer text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Cancel</button>
                <button disabled={payM.isPending} onClick={() => { setError(""); payM.mutate(); }}
                  className="cursor-pointer rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-[var(--color-on-brand)] hover:bg-emerald-400 disabled:opacity-50">
                  {payM.isPending ? "Logging..." : "Confirm payout"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* controls */}
        {!rejecting && !paying && !revising ? (
          <div className="border-t border-[var(--color-border)] px-5 py-4">
            {sub.claimed && sub.status !== "paid" ? (
              <p className="mb-3 rounded-md bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-400">Creator has claimed this payment.</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {sub.verification_status !== "verified" && !isPaid ? (
                <button disabled={verifyM.isPending || !canVerify} onClick={() => { setError(""); verifyM.mutate(); }}
                  className="cursor-pointer rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/25 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Approve this post after watching it above">Approve</button>
              ) : null}
              {!isPaid ? (
                <button onClick={() => { setPaying(true); setError(""); }}
                  className="cursor-pointer rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-[var(--color-on-brand)] hover:bg-emerald-400">Log payout</button>
              ) : null}
              {sub.verification_status !== "verified" && !isPaid ? (
                <>
                  <button onClick={() => { setNote(""); setRevising("edit"); setError(""); }}
                    title="Send back so the creator can fix and re-submit this same post"
                    className="cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/25 hover:bg-amber-500/10">Send for review</button>
                  <button onClick={() => { setNote(""); setRevising("repost"); setError(""); }}
                    title="Send back and ask the creator to post a brand-new video"
                    className="cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/25 hover:bg-amber-500/10">Repost</button>
                </>
              ) : null}
              {sub.verification_status !== "rejected" && !isPaid ? (
                <button onClick={() => { setRejecting(true); setError(""); }}
                  className="cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-red-400 hover:ring-red-500/25">Reject</button>
              ) : null}
              <button disabled={flagCreatorM.isPending} onClick={() => { setError(""); flagCreatorM.mutate(); }}
                className="cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/25 hover:bg-amber-500/10 disabled:opacity-50">
                {sub.creator_is_suspicious ? "Unsuspend user" : "Suspend user"}
              </button>
              {confirmDelete ? (
                <button disabled={deleteM.isPending} onClick={() => { setError(""); deleteM.mutate(); }}
                  className="cursor-pointer rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 ring-1 ring-inset ring-red-500/40 disabled:opacity-50">Confirm delete</button>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  className="cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)] ring-1 ring-inset ring-[var(--color-border)] hover:text-red-400 hover:ring-red-500/25">Delete</button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
