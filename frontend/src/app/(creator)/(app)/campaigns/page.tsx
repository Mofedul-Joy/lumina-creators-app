"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CampaignCard } from "@/components/campaign/CampaignCard";
import { getAuthToken } from "@/lib/auth";
import { browseCampaigns } from "@/lib/campaigns";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";

const ALL_PLATFORMS = ["tiktok", "instagram", "youtube", "twitter", "facebook"] as const;

export default function CampaignsPage() {
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => setHasToken(!!getAuthToken()), []);
  const [tab, setTab] = useState<"all" | "submitted">("all");
  const [platform, setPlatform] = useState<string>("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["campaigns"],
    queryFn: browseCampaigns,
    enabled: hasToken,
    retry: false,
  });

  const campaigns = useMemo(() => {
    return (data ?? []).filter((c) => {
      if (tab === "submitted" && !c.joined) return false;
      if (platform && !c.platforms.includes(platform)) return false;
      return true;
    });
  }, [data, tab, platform]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Lumina Creators</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Campaigns</h1>
          <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
            Live campaigns you can enter. Pick one, post, and get paid on the views.
          </p>
        </div>

        {hasToken ? (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-full bg-[var(--color-surface)] p-1">
              {([["all", "All campaigns"], ["submitted", "Submitted"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`min-h-8 cursor-pointer rounded-full px-3.5 text-sm transition ${
                    tab === key ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-full bg-[var(--color-surface)] p-1">
              <button
                onClick={() => setPlatform("")}
                className={`min-h-8 cursor-pointer rounded-full px-3 text-xs transition ${
                  platform === "" ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                All
              </button>
              {ALL_PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(platform === p ? "" : p)}
                  aria-label={platformLabel(p)}
                  title={platformLabel(p)}
                  className={`grid h-8 w-8 cursor-pointer place-items-center rounded-full transition ${
                    platform === p ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <PlatformIcon name={p} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!hasToken ? (
          <EmptyState
            title="Sign in to browse campaigns"
            body="You need a creator account to see live campaigns."
            cta={{ href: "/login", label: "Sign in" }}
          />
        ) : isLoading ? (
          <SkeletonCardGrid count={6} />
        ) : isError ? (
          <EmptyState title="Couldn't load campaigns" body={(error as Error).message} />
        ) : campaigns.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={tab === "submitted" ? "No submitted campaigns yet" : "No live campaigns match"}
            body={tab === "submitted"
              ? "Enter a campaign and submit a post to see it here."
              : "New campaigns drop regularly. Add your socials so you're ready to enter the moment one goes live."}
            cta={tab === "submitted" ? { href: "/campaigns", label: "Browse all campaigns" } : { href: "/onboarding", label: "Build your profile" }}
          />
        )}
      </main>
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
