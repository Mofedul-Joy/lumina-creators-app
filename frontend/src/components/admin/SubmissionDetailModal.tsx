"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import {
  deleteSubmission, logSubmissionPayout, rejectSubmission, verifySubmission,
  type AdminSubmission, type PayoutMethod,
} from "@/lib/admin";
import { flagCreatorSuspicious, unflagCreatorSuspicious } from "@/lib/api";
import { getAdminToken } from "@/lib/auth";
import { getEmbedUrl } from "@/lib/embeds";
import { fmtInt, fmtMoney } from "@/lib/format";

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
export function SubmissionDetailModal({ sub, onClose }: { sub: AdminSubmission; onClose: () => void }) {
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<PayoutMethod>("paypal");
  const [reference, setReference] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const done = () => { qc.invalidateQueries({ queryKey: ["dash-submissions"] }); onClose(); };
  const refetchStay = () => qc.invalidateQueries({ queryKey: ["dash-submissions"] });
  const fail = (e: unknown) => setError((e as Error).message);

  const verifyM = useMutation({ mutationFn: () => verifySubmission(sub.id), onSuccess: done, onError: fail });
  const rejectM = useMutation({ mutationFn: () => rejectSubmission(sub.id, note.trim()), onSuccess: done, onError: fail });
  const payM = useMutation({ mutationFn: () => logSubmissionPayout(sub.id, method, reference), onSuccess: done, onError: fail });
  const deleteM = useMutation({ mutationFn: () => deleteSubmission(sub.id), onSuccess: done, onError: fail });
  const flagCreatorM = useMutation({
    mutationFn: () => (sub.creator_is_suspicious
      ? unflagCreatorSuspicious(getAdminToken() ?? "", sub.creator_id)
      : flagCreatorSuspicious(getAdminToken() ?? "", sub.creator_id)),
    onSuccess: refetchStay, onError: fail,
  });

  const embedUrl = getEmbedUrl(sub.platform, sub.post_url);
  const isPaid = sub.status === "paid";

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
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

        <div className="max-h-[70vh] overflow-y-auto p-5">
          {/* media */}
          <a
            href={sub.post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block aspect-video w-full overflow-hidden rounded-[var(--radius-btn)] bg-gradient-to-br from-[var(--color-brand)]/25 to-[var(--color-bg-deep)] bg-cover bg-center"
            style={sub.thumbnail_url ? { backgroundImage: `url(${sub.thumbnail_url})` } : undefined}
          >
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5Z" /></svg>
              </span>
            </span>
            <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white">
              {platformLabel(sub.platform)}{embedUrl ? "" : " · open post"}
            </span>
          </a>

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
              View verification video
            </a>
          ) : (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">No verification video uploaded yet.</p>
          )}
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
          ) : paying ? (
            <div className="mt-4 space-y-2 rounded-[var(--radius-btn)] bg-[var(--color-surface-2)] p-3">
              <p className="text-sm font-medium text-[var(--color-text)]">Log payout of {fmtMoney(sub.estimated_amount)}</p>
              <div className="grid grid-cols-2 gap-2">
                <select value={method} onChange={(e) => setMethod(e.target.value as PayoutMethod)}
                  className="min-h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text)]">
                  {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                </select>
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
        {!rejecting && !paying ? (
          <div className="border-t border-[var(--color-border)] px-5 py-4">
            {sub.claimed && sub.status !== "paid" ? (
              <p className="mb-3 rounded-md bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-400">Creator has claimed this payment.</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {sub.verification_status !== "verified" && !isPaid ? (
                <button disabled={verifyM.isPending} onClick={() => { setError(""); verifyM.mutate(); }}
                  className="cursor-pointer rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-50"
                  title="Confirm you've watched the proof video and the stats are legit">Verify</button>
              ) : null}
              {!isPaid ? (
                <button onClick={() => { setPaying(true); setError(""); }}
                  className="cursor-pointer rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-[var(--color-on-brand)] hover:bg-emerald-400">Log payout</button>
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
