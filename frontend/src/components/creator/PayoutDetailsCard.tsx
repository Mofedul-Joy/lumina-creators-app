"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { updateProfile, PAYOUT_METHODS, type PayoutMethod, type ProfileOut } from "@/lib/api";

// Where the creator tells us how to pay them. Info-capture only — no processing.
// Bill: payments are manual, the admin just needs the address to send funds.
const LABEL: Record<PayoutMethod, string> = { paypal: "PayPal", solana: "Solana", whop: "Whop" };
const PLACEHOLDER: Record<PayoutMethod, string> = {
  paypal: "PayPal email address",
  solana: "Solana wallet address",
  whop: "Whop username",
};
const HELP: Record<PayoutMethod, string> = {
  paypal: "The email on your PayPal account.",
  solana: "Your SOL wallet address (USDC on Solana).",
  whop: "Your Whop username.",
};

export function PayoutDetailsCard({ profile }: { profile: ProfileOut | undefined }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState<PayoutMethod>("paypal");
  const [addr, setAddr] = useState({ paypal: "", solana: "", whop: "" });
  const [saved, setSaved] = useState(false);

  // Hydrate from the saved profile (per-method address, with the legacy single
  // address as a fallback for whichever method was selected before).
  useEffect(() => {
    if (!profile) return;
    setMethod((profile.payout_method as PayoutMethod) || "paypal");
    setAddr({
      paypal: profile.payout_paypal ?? (profile.payout_method === "paypal" ? profile.payout_address ?? "" : ""),
      solana: profile.payout_solana ?? (profile.payout_method === "solana" ? profile.payout_address ?? "" : ""),
      whop: profile.payout_whop ?? (profile.payout_method === "whop" ? profile.payout_address ?? "" : ""),
    });
  }, [profile]);

  const saveM = useMutation({
    mutationFn: () => {
      const token = getAuthToken();
      if (!token) throw new Error("Not signed in");
      return updateProfile(token, {
        payout_method: method,
        payout_paypal: addr.paypal.trim() || undefined,
        payout_solana: addr.solana.trim() || undefined,
        payout_whop: addr.whop.trim() || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const current = addr[method];

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">Payout details</h2>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        How you want to get paid. We don&apos;t move money automatically — an admin pays you manually using these details.
      </p>

      <div className="card-grad mt-3 rounded-[var(--radius-card)] p-5">
        <span className="text-sm font-medium text-[var(--color-text)]">Preferred method</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {PAYOUT_METHODS.map((m) => {
            const on = method === m;
            return (
              <button
                key={m} type="button" onClick={() => setMethod(m)}
                className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  on
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-soft)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand)]"
                }`}
              >
                {LABEL[m]}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <label htmlFor="payout-addr" className="block text-sm font-medium text-[var(--color-text)]">
            {LABEL[method]} details
          </label>
          <input
            id="payout-addr" value={current}
            onChange={(e) => setAddr((a) => ({ ...a, [method]: e.target.value }))}
            placeholder={PLACEHOLDER[method]}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-brand)]"
          />
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{HELP[method]}</p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => saveM.mutate()}
            disabled={saveM.isPending || !current.trim()}
            className="inline-flex min-h-10 cursor-pointer items-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saveM.isPending ? "Saving…" : "Save payout details"}
          </button>
          {saved ? <span className="text-sm text-[var(--color-brand-soft)]">Saved.</span> : null}
          {saveM.isError ? (
            <span className="text-sm text-[var(--color-danger)]">{(saveM.error as Error).message}</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
