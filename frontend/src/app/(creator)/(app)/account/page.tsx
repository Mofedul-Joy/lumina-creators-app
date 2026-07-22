"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth";
import { deleteExperience, getProfile, isAuthError, listExperiences, type ExperienceOut, retryNonAuth} from "@/lib/api";
import { AddExperienceModal } from "@/components/creator/AddExperienceModal";
import { PayoutDetailsCard } from "@/components/creator/PayoutDetailsCard";
import dynamic from "next/dynamic";
// The full 16-step wizard only renders on the "profile" tab (behind a click),
// so keep its weight out of the account page's initial bundle.
const OnboardingWizard = dynamic(
  () => import("@/components/creator/onboarding/OnboardingWizard").then((m) => m.OnboardingWizard),
  { ssr: false },
);
import { TopVideosTab } from "@/components/creator/TopVideosTab";
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

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube",
  twitter: "X", facebook: "Facebook", linkedin: "LinkedIn", other: "Other",
};

function ExperienceCard({ e, onDelete }: { e: ExperienceOut; onDelete: (id: string) => void }) {
  // The little grey line under the title: role/type, then any deliverable and
  // when it happened — only the parts that were filled in.
  const meta = [e.title !== e.kind_label ? `${e.title} · ${e.kind_label}` : e.kind_label,
    e.deliverable, e.niche, e.period].filter(Boolean).join(" · ");
  return (
    <div className="card-grad flex items-start gap-4 rounded-[var(--radius-card)] p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-[var(--color-text)]">{e.org || "Company"}</p>
          {e.verified ? (
            <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--color-brand)] text-[var(--color-on-brand)]" title="Verified">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{meta}</p>

        {e.description ? (
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{e.description}</p>
        ) : null}
        {e.results ? (
          <p className="mt-1.5 text-xs font-medium text-[var(--color-brand-soft)]">{e.results}</p>
        ) : null}

        {(e.platforms?.length || e.work_url) ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {(e.platforms ?? []).map((p) => (
              <span key={p} className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] text-[var(--color-text-muted)]">
                {PLATFORM_LABELS[p] ?? p}
              </span>
            ))}
            {e.work_url ? (
              <a
                href={e.work_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-brand-soft)] hover:underline"
              >
                View work
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M7 17 17 7M17 7H9m8 0v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
      <button
        onClick={() => onDelete(e.id)}
        aria-label="Remove experience"
        className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-danger)]"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "profile", label: "Profile" },
  { key: "experiences", label: "Experiences" },
  { key: "top-videos", label: "Top Videos" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function AccountPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<TabKey>("overview");
  const [addOpen, setAddOpen] = useState(false);
  useEffect(() => {
    setToken(getAuthToken());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  const enabled = ready && !!token;
  const bearer = token ?? "";
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => getProfile(bearer), enabled, retry: retryNonAuth });
  const gamificationQ = useQuery({ queryKey: ["my-gamification"], queryFn: getMyGamification, enabled, retry: retryNonAuth });
  const subsQ = useQuery({ queryKey: ["submissions"], queryFn: listSubmissions, enabled, retry: retryNonAuth });
  const expQ = useQuery({ queryKey: ["experiences"], queryFn: () => listExperiences(bearer), enabled, retry: retryNonAuth });

  async function removeExperience(id: string) {
    if (!token) return;
    await deleteExperience(token, id);
    qc.invalidateQueries({ queryKey: ["experiences"] });
  }

  useEffect(() => {
    if (profileQ.isError && isAuthError(profileQ.error)) router.replace("/login");
  }, [profileQ.isError, profileQ.error, router]);

  if (!ready || !token || profileQ.isLoading)
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
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
    <main className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Lumina Creators</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Account</h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">Your profile summary, rank, and lifetime stats.</p>

      {/* Profile summary */}
      <div className="card-lumina mt-8 flex flex-col gap-5 rounded-[var(--radius-card)] p-8 sm:flex-row sm:items-center">
        <Avatar url={profile?.avatar_url ?? null} name={profile?.display_name ?? "creator"} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-semibold text-[var(--color-text)]">
            {profile?.display_name || "Unnamed creator"}
          </h2>
          {profile?.email ? (
            <p className="mt-1 truncate text-xl">
              <span className="text-[var(--color-text-muted)]">Signed in as </span>
              <span className="font-semibold text-[var(--color-text)]">{profile.email}</span>
            </p>
          ) : null}
          <p className="mt-1.5 line-clamp-2 text-sm text-[var(--color-text-secondary)]">
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

      {/* tabs */}
      <div className="mt-6 inline-flex items-center gap-1 rounded-full bg-[var(--color-surface)] p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-9 cursor-pointer rounded-full px-4 text-sm transition ${
              tab === t.key
                ? "bg-[var(--color-surface-2)] font-medium text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "experiences" ? (
        <section className="mt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Experiences</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Past brand work and roles. Added experiences are verified automatically.
              </p>
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-full bg-[var(--color-brand)] px-4 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
            >
              Add experience
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {expQ.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (expQ.data ?? []).length === 0 ? (
              <div className="card-lumina rounded-[var(--radius-card)] p-10 text-center text-sm text-[var(--color-text-secondary)]">
                No experiences yet. Add your first one to strengthen your profile.
              </div>
            ) : (
              (expQ.data ?? []).map((e) => <ExperienceCard key={e.id} e={e} onDelete={removeExperience} />)
            )}
          </div>

          <AddExperienceModal
            open={addOpen}
            onClose={() => setAddOpen(false)}
            onAdded={() => qc.invalidateQueries({ queryKey: ["experiences"] })}
          />
        </section>
      ) : null}

      {tab === "profile" ? (
        <section className="mt-6">
          <Suspense fallback={<p className="text-sm text-[var(--color-text-secondary)]">Loading profile…</p>}>
            <OnboardingWizard />
          </Suspense>
        </section>
      ) : null}

      {tab === "top-videos" ? <TopVideosTab /> : null}

      {tab !== "overview" ? null : (
        <>
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

      {/* How the creator gets paid (manual payouts) */}
      <PayoutDetailsCard profile={profile} />
        </>
      )}
    </main>
  );
}
