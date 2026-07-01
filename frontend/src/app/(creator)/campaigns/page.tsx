"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreatorNav } from "@/components/creator/CreatorNav";
import { CampaignCard } from "@/components/campaign/CampaignCard";
import { getAuthToken } from "@/lib/auth";
import { browseCampaigns } from "@/lib/campaigns";

export default function CampaignsPage() {
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => setHasToken(!!getAuthToken()), []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["campaigns"],
    queryFn: browseCampaigns,
    enabled: hasToken,
    retry: false,
  });

  return (
    <div className="min-h-[100dvh]">
      <CreatorNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">Campaigns</h1>
          <p className="mt-1 text-[var(--color-text-secondary)]">
            Live campaigns you can enter. Pick one, post, and get paid on the views.
          </p>
        </div>

        {!hasToken ? (
          <EmptyState
            title="Sign in to browse campaigns"
            body="You need a creator account to see live campaigns."
            cta={{ href: "/login", label: "Sign in" }}
          />
        ) : isLoading ? (
          <p className="text-[var(--color-text-muted)]">Loading campaigns…</p>
        ) : isError ? (
          <EmptyState title="Couldn’t load campaigns" body={(error as Error).message} />
        ) : data && data.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((c) => (
              <CampaignCard key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No live campaigns yet"
            body="New campaigns drop regularly. Finish your profile so you’re ready to enter the moment one goes live."
            cta={{ href: "/onboarding", label: "Complete your profile" }}
          />
        )}
      </main>
    </div>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-[var(--color-text-secondary)]">{body}</p>
      {cta ? (
        <Link
          href={cta.href}
          className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}
