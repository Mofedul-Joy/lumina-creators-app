"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth";
import { getProfile, isAuthError } from "@/lib/api";
import { listSubmissions } from "@/lib/campaigns";
import { getMyGamification } from "@/lib/gamification";
import { fmtInt, fmtMoney } from "@/lib/format";
import { Skeleton, SkeletonStats } from "@/components/ui/Skeleton";
import { RankBadge } from "@/components/gamification/RankBadge";
import { XpBar } from "@/components/gamification/XpBar";
import { StreakFlame } from "@/components/gamification/StreakFlame";
import { AwardRow } from "@/components/gamification/AwardBadge";

function Avatar({ url, name }: { url: string | null; name: string }) {
  const initials = (name || "?").trim().slice(0, 1).toUpperCase();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="h-20 w-20 rounded-full object-cover ring-2 ring-[var(--color-border)]" />;
  }
  return (
    <div className="grid h-20 w-20 place-items-center rounded-full bg-[var(--color-surface-2)] text-2xl font-semibold text-[var(--color-text-muted)] ring-2 ring-[var(--color-border)]">
      {initials}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-center">
      <p className="text-xl font-semibold text-[var(--color-text)]">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}

export default function AccountPage() {
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

  const enabled = ready && !!token;
  const bearer = token ?? "";
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => getProfile(bearer), enabled, retry: false });
  const gamificationQ = useQuery({ queryKey: ["my-gamification"], queryFn: getMyGamification, enabled, retry: false });
  const subsQ = useQuery({ queryKey: ["submissions"], queryFn: listSubmissions, enabled, retry: false });

  useEffect(() => {
    if (profileQ.isError && isAuthError(profileQ.error)) router.replace("/login");
  }, [profileQ.isError, profileQ.error, router]);

  if (!ready || !token || profileQ.isLoading)
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-10 w-72" />
        <div className="mt-8"><SkeletonStats count={3} /></div>
      </main>
    );

  const profile = profileQ.data;
  const subs = subsQ.data ?? [];
  const totalViews = subs.reduce((acc, s) => acc + s.views, 0);
  const totalEarned = subs.reduce((acc, s) => acc + Number(s.estimated_amount), 0);
  const g = gamificationQ.data;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Lumina Creators</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Account</h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">Your profile summary, rank, and lifetime stats.</p>

      {/* Profile summary */}
      <div className="card-lumina mt-8 flex flex-col gap-4 rounded-[var(--radius-card)] p-6 sm:flex-row sm:items-center">
        <Avatar url={profile?.avatar_url ?? null} name={profile?.display_name ?? "creator"} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold text-[var(--color-text)]">
            {profile?.display_name || "Unnamed creator"}
          </h2>
          <p className="mt-1 line-clamp-2 text-sm text-[var(--color-text-secondary)]">
            {profile?.bio || "No bio yet — add one from your profile."}
          </p>
        </div>
        <Link
          href="/onboarding"
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] px-4 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-text-muted)]"
        >
          Edit profile
        </Link>
      </div>

      {!profile?.completed ? (
        <Link
          href="/onboarding"
          className="card-interactive mt-4 flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-[var(--color-bg-deep)] p-5"
        >
          <div>
            <p className="text-sm font-semibold text-amber-400">Your profile is incomplete</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Finish onboarding to unlock better campaign matches.
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium text-amber-400">Finish onboarding →</span>
        </Link>
      ) : null}

      {/* Gamification card */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Rank &amp; progress</h2>
        <div className="card-grad mt-3 rounded-[var(--radius-card)] p-5">
          {gamificationQ.isLoading || !g ? (
            <>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-4 h-2 w-full" />
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <RankBadge rank={g.rank} size="lg" />
                  <span className="text-sm text-[var(--color-text-secondary)]">{g.rank_label} Creator</span>
                </div>
                <StreakFlame days={g.streak_days} />
              </div>
              <div className="mt-4">
                <XpBar xp={g.xp} xpToNext={g.xp_to_next} nextRank={g.next_rank} />
              </div>
              <div className="mt-5">
                <AwardRow awards={g.awards} />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Aggregate stats */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Lifetime stats</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatTile label="Total views" value={fmtInt(g?.total_views ?? totalViews)} />
          <StatTile label="Total earned" value={fmtMoney(g?.total_earned ?? totalEarned)} />
          <StatTile label="Total posts" value={fmtInt(g?.total_posts ?? subs.length)} />
        </div>
      </section>
    </main>
  );
}
