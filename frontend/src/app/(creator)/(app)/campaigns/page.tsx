"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CampaignCard } from "@/components/campaign/CampaignCard";
import { CampaignModal } from "@/components/campaign/CampaignModal";
import { CampaignSearchModal } from "@/components/creator/CampaignSearchModal";
import { getAuthToken } from "@/lib/auth";
import { getProfile, listSocials, retryNonAuth} from "@/lib/api";
import { browseCampaigns, type Campaign } from "@/lib/campaigns";
import { NICHES, campaignText, matchesNiche, nicheLabel } from "@/lib/niches";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";

const ALL_PLATFORMS = ["tiktok", "instagram", "youtube", "twitter", "facebook"] as const;
const SORTS = [["newest", "Newest"], ["trending", "Trending"], ["highest", "Highest pay"]] as const;
type Sort = (typeof SORTS)[number][0];

// A single comparable "pay" number so Highest-pay sort works across pricing models.
const payValue = (c: Campaign) => c.cpm_rate || c.per_post_amount || c.fixed_amount || c.hourly_rate || 0;

export default function CampaignsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => { const t = getAuthToken(); setToken(t); setHasToken(!!t); }, []);
  const [tab, setTab] = useState<"all" | "submitted">("all");
  const [platform, setPlatform] = useState<string>("");
  const [search, setSearch] = useState("");
  const [niche, setNiche] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [searchOpen, setSearchOpen] = useState(false);
  const [active, setActive] = useState<Campaign | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["campaigns"],
    queryFn: browseCampaigns,
    enabled: hasToken,
    retry: retryNonAuth,
  });

  const campaigns = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (data ?? []).filter((c) => {
      if (tab === "submitted" && !c.joined) return false;
      if (platform && !c.platforms.includes(platform)) return false;
      if (niche && !matchesNiche(c, niche)) return false;
      if (q && !campaignText(c).includes(q)) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "highest") sorted.sort((a, b) => payValue(b) - payValue(a));
    else if (sort === "trending") sorted.sort((a, b) => b.budget - a.budget);
    else sorted.sort((a, b) => (b.starts_at ?? "").localeCompare(a.starts_at ?? ""));
    return sorted;
  }, [data, tab, platform, niche, search, sort]);

  // "For You": campaigns that best match the creator's profile + socials.
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => getProfile(token ?? ""), enabled: hasToken, retry: retryNonAuth });
  const socialsQ = useQuery({ queryKey: ["socials"], queryFn: () => listSocials(token ?? ""), enabled: hasToken, retry: retryNonAuth });

  const forYou = useMemo(() => {
    const myPlatforms = new Set((socialsQ.data ?? []).map((s) => s.platform as string));
    const creatorType = profileQ.data?.creator_type ?? null;
    const bio = (profileQ.data?.bio ?? "").toLowerCase();
    const myNiches = NICHES.filter((n) => n.keywords.some((k) => bio.includes(k))).map((n) => n.key);

    const scored = (data ?? [])
      .map((c) => {
        let score = 0;
        for (const p of c.platforms) if (myPlatforms.has(p)) score += 2;
        if (creatorType && c.creator_type === creatorType) score += 3;
        for (const nk of myNiches) if (matchesNiche(c, nk)) score += 1;
        return { c, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, 4).map((x) => x.c);
  }, [data, socialsQ.data, profileQ.data]);

  const showForYou = tab === "all" && !search && !niche && !platform && forYou.length > 0;

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
          <>
          {/* search trigger — opens the SideShift-style search overlay */}
          <button
            onClick={() => setSearchOpen(true)}
            className="mb-4 flex w-full max-w-xl cursor-pointer items-center gap-2.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left text-[var(--color-text-muted)] transition hover:border-[var(--color-text-muted)]"
          >
            <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            <span className="text-sm">Search campaigns…</span>
          </button>

          {/* For you — best matches for this creator's profile + socials */}
          {showForYou ? (
            <section className="mb-7">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text)]">For you</h2>
                <span className="rounded-full bg-[var(--color-brand)]/12 px-2 py-0.5 text-[11px] font-medium text-[var(--color-brand-soft)]">Matched to your profile</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {forYou.map((c) => (
                  <CampaignCard key={`fy-${c.id}`} c={c} onOpen={setActive} />
                ))}
              </div>
            </section>
          ) : null}

          {/* Find by niche */}
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-[var(--color-text)]">Find by niche</h2>

          {/* sort pills */}
          <div className="mb-3 flex items-center gap-1 overflow-x-auto no-scrollbar">
            {SORTS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`min-h-8 shrink-0 cursor-pointer rounded-full px-3.5 text-sm transition ${
                  sort === key ? "bg-[var(--color-brand)]/12 font-medium text-[var(--color-brand-soft)] ring-1 ring-inset ring-[var(--color-brand)]/30" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* niche chips — click to filter; active chip glows brand green */}
          <div className="mb-4 flex flex-wrap gap-2">
            {NICHES.map((n) => {
              const active = niche === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => setNiche(active ? "" : n.key)}
                  aria-pressed={active}
                  className={`inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition ${
                    active
                      ? "border-[var(--color-brand)]/40 bg-[var(--color-brand)]/15 font-medium text-[var(--color-brand-soft)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <span className={active ? "text-[var(--color-brand-soft)]" : "text-[var(--color-text-muted)]"}><n.Icon /></span>
                  {n.label}
                </button>
              );
            })}
          </div>

          {/* active search / niche chips */}
          {(search || niche) ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {search ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand)]/12 py-1 pl-3 pr-1.5 text-sm text-[var(--color-brand-soft)]">
                  “{search}”
                  <button onClick={() => setSearch("")} aria-label="Clear search" className="grid h-5 w-5 cursor-pointer place-items-center rounded-full hover:bg-[var(--color-brand)]/20">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
                  </button>
                </span>
              ) : null}
              {niche ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand)]/12 py-1 pl-3 pr-1.5 text-sm text-[var(--color-brand-soft)]">
                  {nicheLabel(niche)}
                  <button onClick={() => setNiche("")} aria-label="Clear niche" className="grid h-5 w-5 cursor-pointer place-items-center rounded-full hover:bg-[var(--color-brand)]/20">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
                  </button>
                </span>
              ) : null}
            </div>
          ) : null}

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
          </>
        ) : null}

        <CampaignSearchModal
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSearch={(q) => { setSearch(q); setNiche(""); }}
          onNiche={(key) => { setNiche(key); setSearch(""); }}
        />
        <CampaignModal campaign={active} onClose={() => setActive(null)} />

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
              <CampaignCard key={c.id} c={c} onOpen={setActive} />
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
