"use client";

// Share Page Link (Feature 6, BUILD_SPEC.md §3.7) — lets an admin mint a
// copyable, no-login "read-only performance page" link for a client.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { disableShareToken, enableShareToken, rotateShareToken } from "@/lib/admin";

export function SharePageLink({
  campaignId,
  shareToken,
  shareEnabled,
}: {
  campaignId: string;
  shareToken: string | null;
  shareEnabled: boolean;
}) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["campaign", campaignId] });
  const enableM = useMutation({ mutationFn: () => enableShareToken(campaignId), onSuccess: refresh });
  const rotateM = useMutation({ mutationFn: () => rotateShareToken(campaignId), onSuccess: refresh });
  const disableM = useMutation({ mutationFn: () => disableShareToken(campaignId), onSuccess: refresh });

  const shareUrl =
    shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/report/${shareToken}`
      : shareToken
        ? `/report/${shareToken}`
        : "";

  function copy() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const busy = enableM.isPending || rotateM.isPending || disableM.isPending;

  return (
    <section className="card-lumina rounded-[var(--radius-card)] p-6">
      <h2 className="mb-1 text-lg font-semibold text-[var(--color-text)]">Share Page Link</h2>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        A read-only performance report clients can view without logging in.
      </p>

      {shareEnabled && shareToken ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none"
            />
            <button
              type="button"
              onClick={copy}
              className="cursor-pointer whitespace-nowrap rounded-xl bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-[var(--color-on-brand)]"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => rotateM.mutate()}
              disabled={busy}
              className="cursor-pointer rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-[var(--color-text)] disabled:opacity-50"
            >
              {rotateM.isPending ? "Rotating…" : "Rotate token"}
            </button>
            <button
              type="button"
              onClick={() => disableM.mutate()}
              disabled={busy}
              className="cursor-pointer rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-red-400 hover:ring-red-500/25 disabled:opacity-50"
            >
              {disableM.isPending ? "Disabling…" : "Disable"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => enableM.mutate()}
          disabled={busy}
          className="cursor-pointer rounded-full bg-[var(--color-brand)] px-5 py-2.5 text-sm font-semibold text-[var(--color-on-brand)] disabled:opacity-50"
        >
          {enableM.isPending ? "Generating…" : "Generate share link"}
        </button>
      )}
    </section>
  );
}
