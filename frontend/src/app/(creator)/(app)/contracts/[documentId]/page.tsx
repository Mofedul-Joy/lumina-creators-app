"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { acceptContract, getContract, isAuthError, retryNonAuth} from "@/lib/api";
import { ContractDocument } from "@/components/contracts/ContractDocument";
import { Skeleton } from "@/components/ui/Skeleton";

export default function ContractPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { documentId } = useParams<{ documentId: string }>();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [signName, setSignName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(getAuthToken());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  const q = useQuery({
    queryKey: ["contract", documentId],
    queryFn: () => getContract(token ?? "", documentId),
    enabled: ready && !!token && !!documentId,
    retry: retryNonAuth,
  });
  useEffect(() => {
    if (q.isError && isAuthError(q.error)) router.replace("/login");
  }, [q.isError, q.error, router]);

  const c = q.data;
  const accepted = c?.status === "accepted";

  async function sign() {
    if (!token || !signName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await acceptContract(token, documentId, signName.trim());
      qc.invalidateQueries({ queryKey: ["contract", documentId] });
      qc.invalidateQueries({ queryKey: ["my-contracts"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign the agreement.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !token || q.isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-6 h-96 w-full" />
      </main>
    );
  }

  if (!c) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-[var(--color-danger)]">This agreement could not be found.</p>
        <Link href="/contracts" className="mt-3 inline-block text-sm text-[var(--color-brand)] underline">All agreements</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {/* print rule: hide the app chrome, show only the document */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #contract-doc, #contract-doc * { visibility: visible !important; }
        #contract-doc { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
        [data-noprint] { display: none !important; }
      }`}</style>

      <div data-noprint className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/contracts" className="text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]">← All agreements</Link>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            accepted ? "bg-[var(--color-brand)]/15 text-[var(--color-brand)]" : "bg-amber-500/15 text-amber-400"
          }`}>
            {accepted ? "Signed" : "Awaiting signature"}
          </span>
          <button
            onClick={() => window.print()}
            className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-brand)]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v7H6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
            Download PDF
          </button>
        </div>
      </div>

      {/* the document */}
      <article id="contract-doc" className="card-lumina mt-5 rounded-[var(--radius-card)] bg-[var(--color-surface)] p-8 sm:p-10">
        <p className="text-center text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">{c.subtitle}</p>
        <ContractDocument body={c.body} />

        {accepted ? (
          <div className="mt-8 rounded-xl border border-[var(--color-brand)]/40 bg-[var(--color-brand)]/10 p-5">
            <p className="text-sm font-semibold text-[var(--color-text)]">Signed by {c.accepted_name}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {c.accepted_at ? new Date(c.accepted_at).toLocaleString() : ""} · Electronic signature captured via Lumina Creators.
            </p>
          </div>
        ) : null}
      </article>

      {/* signature block */}
      {!accepted ? (
        <div data-noprint className="card-lumina mt-5 rounded-[var(--radius-card)] p-6">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Accept & sign</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Type your full legal name. Electronic acceptance is deemed equivalent to a handwritten signature.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={signName}
              onChange={(e) => setSignName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sign()}
              placeholder="Your full name"
              className="min-h-11 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
            />
            <button
              onClick={sign}
              disabled={!signName.trim() || busy}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-[var(--color-brand)] px-6 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Signing…" : "Accept & sign"}
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
        </div>
      ) : null}
    </main>
  );
}
