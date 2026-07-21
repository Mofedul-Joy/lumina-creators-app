"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { publicApi, type PublicCampaign } from "@/lib/api";
import { campaignImage } from "@/lib/campaignTheme";
import { fmtMoney } from "@/lib/format";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";
import { LuminaMark } from "@/components/ui/LuminaMark";

const MODE_LABEL: Record<PublicCampaign["mode"], string> = {
  create_new: "Create new content",
  copy_paste: "Repost approved clips",
};
const ALL_PLATFORMS = ["tiktok", "instagram", "youtube", "twitter", "facebook"] as const;

function CardInner({ c, completed }: { c: PublicCampaign; completed?: boolean }) {
  return (
    <>
      <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-[var(--color-brand)]/30 to-[var(--color-bg-deep)]">
        {/* Uploaded banner, else a niche-matched stock photo — never an empty card. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={campaignImage(c)}
          alt=""
          loading="lazy"
          className={`h-full w-full object-cover ${completed ? "opacity-50 grayscale" : "transition duration-300 group-hover:scale-[1.03]"}`}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--color-bg-deep)]/80 via-transparent to-transparent" />
        <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
          {completed ? "Completed" : MODE_LABEL[c.mode]}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium text-[var(--color-text-secondary)]">
            {c.brand_name ?? "Lumina campaign"}
          </span>
          <div className="flex shrink-0 items-center gap-1.5 text-[var(--color-text-muted)]">
            {c.platforms.map((p) => (
              <PlatformIcon key={p} name={p} className="h-3.5 w-3.5" />
            ))}
          </div>
        </div>
        {/* h2 (not h3) so the landing page heading order is h1 → h2 with no
            skipped level — fixes the Lighthouse "heading-order" a11y audit. */}
        <h2 className={`mt-1 text-lg font-semibold text-[var(--color-text)] transition-colors ${completed ? "" : "group-hover:text-[var(--color-brand)]"}`}>
          {c.name}
        </h2>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="tabular text-2xl font-semibold text-[var(--color-brand)]">{fmtMoney(c.cpm_rate)}</span>
          <span className="text-sm text-[var(--color-text-muted)]">CPM / 1,000 views</span>
        </div>
        <div className="mt-auto pt-5">
          {completed ? (
            <span className="flex min-h-10 w-full items-center justify-center rounded-full border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-muted)]">
              Campaign ended
            </span>
          ) : (
            <span className="flex min-h-10 w-full items-center justify-center rounded-full bg-[var(--color-brand)] text-sm font-semibold text-[var(--color-on-brand)] transition group-hover:bg-[var(--color-brand-hover)]">
              Enter campaign
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function CampaignCard({ c, completed, onEnter }: { c: PublicCampaign; completed?: boolean; onEnter: (c: PublicCampaign) => void }) {
  // Completed campaigns are read-only — no submit flow, so render a plain card.
  if (completed) {
    return (
      <div className="card-lumina flex flex-col overflow-hidden rounded-[var(--radius-card)]">
        <CardInner c={c} completed />
      </div>
    );
  }
  // Entering a campaign requires an account — a logged-out visitor gets the
  // sign-in/up prompt; a signed-in creator goes straight to the campaign.
  return (
    <button
      type="button"
      onClick={() => onEnter(c)}
      className="card-lumina card-interactive group flex flex-col overflow-hidden rounded-[var(--radius-card)] text-left"
    >
      <CardInner c={c} />
    </button>
  );
}

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<"live" | "completed">("live");
  // Holds the slug of the campaign a logged-out visitor is trying to enter, so
  // signup/login can route them straight back to it afterwards (Bill's flow:
  // click Test4 → sign up → land inside Test4). null = prompt closed.
  const [authPrompt, setAuthPrompt] = useState<string | null>(null);
  // Persistent login: if a creator session already exists in this browser, the
  // header shows a "Go to dashboard" button instead of Sign in / Sign up, so a
  // returning creator never has to log in again. Read after mount (localStorage
  // is client-only) to avoid a hydration mismatch.
  const [authed, setAuthed] = useState(false);
  useEffect(() => { setAuthed(!!getAuthToken()); }, []);

  const enterCampaign = (c: PublicCampaign) => {
    // Signed-in creators go straight in; everyone else is asked to sign in / up.
    if (getAuthToken()) router.push(`/campaigns/${c.slug}`);
    else setAuthPrompt(c.slug);
  };
  const authNext = authPrompt ? `?next=${encodeURIComponent(`/campaigns/${authPrompt}`)}` : "";
  const q = useQuery({
    queryKey: ["public-campaigns", view],
    queryFn: () => publicApi.campaigns(view === "completed" ? "completed" : "active"),
    refetchInterval: 120_000,
  });
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<string>("");

  const campaigns = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (q.data ?? []).filter((c) => {
      if (platform && !c.platforms.includes(platform)) return false;
      if (term && !`${c.name} ${c.brand_name ?? ""}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [q.data, search, platform]);

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg-deep)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <LuminaMark size={28} />
            <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">Lumina Creators</span>
          </Link>
          <div className="flex items-center gap-2">
            {authed ? (
              <Link
                href="/dashboard"
                className="inline-flex min-h-9 items-center rounded-full bg-[var(--color-brand)] px-4 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex min-h-9 items-center rounded-full border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-brand)]"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex min-h-9 items-center rounded-full bg-[var(--color-brand)] px-4 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">
          {view === "completed" ? "Past campaigns" : "Live campaigns"}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">
          Pick a campaign, post, get paid.
        </h1>
        <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
          No following required. Submit a post from any campaign below and we&apos;ll take it from there.
        </p>

        {/* live / completed toggle */}
        <div className="mt-6 inline-flex items-center gap-1 rounded-full bg-[var(--color-surface)] p-1">
          {([["live", "Live"], ["completed", "Completed"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`min-h-8 cursor-pointer rounded-full px-4 text-sm transition ${
                view === key ? "bg-[var(--color-surface-2)] font-medium text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* search + platform-icon filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for a campaign..."
              className="min-h-10 w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] pl-10 pr-4 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
            />
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </span>
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

        <div className="mt-8">
          {q.isLoading ? (
            <SkeletonCardGrid count={6} />
          ) : campaigns.length === 0 ? (
            <div className="card-lumina rounded-[var(--radius-card)] p-10 text-center text-sm text-[var(--color-text-secondary)]">
              {q.data?.length
                ? "No campaigns match your filters."
                : view === "completed"
                  ? "No completed campaigns yet."
                  : "No campaigns are live right now. Check back soon."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((c) => (
                <CampaignCard key={c.id} c={c} completed={view === "completed"} onEnter={enterCampaign} />
              ))}
            </div>
          )}
        </div>
      </main>

      {authPrompt ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="auth-prompt-title">
          <button aria-label="Close" onClick={() => setAuthPrompt(null)} className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" />
          <div className="card-lumina relative w-full max-w-sm rounded-[var(--radius-card)] p-6 text-center">
            <button
              onClick={() => setAuthPrompt(null)}
              aria-label="Close"
              className="absolute right-3 top-3 grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-brand)]/12 text-[var(--color-brand)]">
              <LuminaMark size={26} />
            </span>
            <h2 id="auth-prompt-title" className="mt-4 text-lg font-semibold text-[var(--color-text)]">Sign up or sign in to enter the campaign</h2>
            <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
              Create a free Lumina account (or sign in) to enter this campaign and start earning on your posts.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Link
                href={`/signup${authNext}`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--color-brand)] text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
              >
                Sign up
              </Link>
              <Link
                href={`/login${authNext}`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--color-border)] text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-brand)]"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
