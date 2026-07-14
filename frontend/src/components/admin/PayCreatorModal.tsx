"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordPayout, type PayoutMethod } from "@/lib/admin";
import { fmtMoney } from "@/lib/format";
import type { CreatorDetail } from "@/lib/api";

// Admin "Pay now" (Bill: payments stay manual). This modal does NOT move money —
// it shows exactly where/how to pay the creator from their saved details so the
// admin can copy them, pay by hand, then paste the receipt/transaction ID back
// here. Confirming records the payout against the creator's owed balance.
const METHODS: PayoutMethod[] = ["paypal", "solana", "whop"];
const LABEL: Record<PayoutMethod, string> = { paypal: "PayPal", solana: "Solana", whop: "Whop" };
const DETAIL_LABEL: Record<PayoutMethod, string> = {
  paypal: "PayPal email",
  solana: "Solana wallet address",
  whop: "Whop username",
};

function addressFor(c: CreatorDetail, m: PayoutMethod): string {
  const per = m === "paypal" ? c.payout_paypal : m === "solana" ? c.payout_solana : c.payout_whop;
  if (per) return per;
  // Fall back to the legacy single address only when it belongs to this method.
  return c.payout_method === m ? c.payout_address ?? "" : "";
}

export function PayCreatorModal({
  creator,
  owed,
  onClose,
}: {
  creator: CreatorDetail;
  owed: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [method, setMethod] = useState<PayoutMethod>((creator.payout_method as PayoutMethod) || "paypal");
  const [reference, setReference] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setMounted(true), []);

  const address = addressFor(creator, method);
  const canPay = owed > 0;

  const payM = useMutation({
    mutationFn: () => recordPayout(creator.id, method, reference.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-creator-activity", creator.id] });
      qc.invalidateQueries({ queryKey: ["admin-creator", creator.id] });
      onClose();
    },
    onError: (e) => setError((e as Error).message),
  });

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the field is selectable as a fallback */ }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4">
      <div
        className="w-full max-w-md overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">Pay {creator.display_name || creator.email}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Owed now: <span className="font-medium text-[var(--color-brand-soft)]">{fmtMoney(owed)}</span></p>
          </div>
          <button onClick={onClose} className="cursor-pointer rounded-full p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Payments are manual. Copy the details below, pay the creator from the company account, then paste the receipt / transaction ID and confirm.
          </p>

          {/* method */}
          <div>
            <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Method</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {METHODS.map((m) => {
                const on = method === m;
                const preferred = creator.payout_method === m;
                return (
                  <button
                    key={m} onClick={() => setMethod(m)}
                    className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                      on
                        ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-soft)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand)]"
                    }`}
                  >
                    {LABEL[m]}{preferred ? " · preferred" : ""}
                  </button>
                );
              })}
            </div>
          </div>

          {/* address (copyable) */}
          <div>
            <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{DETAIL_LABEL[method]}</span>
            {address ? (
              <div className="mt-1.5 flex items-stretch gap-2">
                <input
                  readOnly value={address} onFocus={(e) => e.currentTarget.select()}
                  className="min-h-10 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)]"
                />
                <button
                  onClick={copyAddress}
                  className="shrink-0 cursor-pointer rounded-lg border border-[var(--color-border)] px-3 text-xs font-medium text-[var(--color-text)] transition hover:border-[var(--color-brand)]"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            ) : (
              <p className="mt-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                The creator hasn&apos;t added their {LABEL[method]} details yet.
              </p>
            )}
          </div>

          {/* receipt */}
          <div>
            <label htmlFor="pay-ref" className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Receipt / transaction ID</label>
            <input
              id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="Paste the ID from PayPal / Solana / Whop"
              className="mt-1.5 min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
            />
          </div>

          {!canPay ? (
            <p className="text-xs text-[var(--color-text-muted)]">Nothing is owed right now — there are no verified, unpaid earnings to settle.</p>
          ) : null}
          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
          <button onClick={onClose} className="cursor-pointer rounded-full px-4 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Cancel</button>
          <button
            disabled={!canPay || payM.isPending}
            onClick={() => { setError(""); payM.mutate(); }}
            title={canPay ? "Record this payout and mark the owed balance paid" : "Nothing owed to settle"}
            className="cursor-pointer rounded-full bg-[var(--color-brand)] px-5 py-1.5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {payM.isPending ? "Saving…" : `Mark ${fmtMoney(owed)} paid`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
