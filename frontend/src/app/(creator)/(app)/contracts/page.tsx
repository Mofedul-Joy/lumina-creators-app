"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { listMyContracts, isAuthError, type ContractStatus, retryNonAuth} from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

const STATUS_STYLE: Record<ContractStatus, string> = {
  accepted: "bg-[var(--color-brand)]/15 text-[var(--color-brand)]",
  sent: "bg-amber-500/15 text-amber-400",
  viewed: "bg-amber-500/15 text-amber-400",
  declined: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
};
const STATUS_LABEL: Record<ContractStatus, string> = {
  accepted: "Signed",
  sent: "Awaiting signature",
  viewed: "Awaiting signature",
  declined: "Declined",
};

export default function ContractsListPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setToken(getAuthToken());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  const q = useQuery({
    queryKey: ["my-contracts"],
    queryFn: () => listMyContracts(token ?? ""),
    enabled: ready && !!token,
    retry: retryNonAuth,
  });
  useEffect(() => {
    if (q.isError && isAuthError(q.error)) router.replace("/login");
  }, [q.isError, q.error, router]);

  const contracts = q.data ?? [];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Lumina Creators</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Agreements</h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">Your Campaign Participation Agreements. Review and sign to confirm your terms.</p>

      <div className="mt-8 space-y-3">
        {q.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : contracts.length === 0 ? (
          <div className="card-lumina rounded-[var(--radius-card)] p-10 text-center text-sm text-[var(--color-text-secondary)]">
            No agreements yet. When you join a campaign, your agreement shows up here.
          </div>
        ) : (
          contracts.map((c) => (
            <Link
              key={c.document_id}
              href={`/contracts/${c.document_id}`}
              className="card-interactive flex items-center justify-between gap-4 rounded-[var(--radius-card)] p-5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--color-text)]">{c.campaign_name}</p>
                <p className="mt-0.5 truncate text-sm text-[var(--color-text-secondary)]">{c.company_name}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[c.status]}`}>
                {STATUS_LABEL[c.status]}
              </span>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
