"use client";

// Shared SideShift-style rich creator/applicant detail card (Feature 2 —
// BUILD_SPEC.md §3.1 detail panel + §3.9 gamification). Reused on:
//   - /admin/creators/[id]            (full-page hero)
//   - /admin/creators list cards      (compact variant, see CreatorCardCompact)
//   - /admin/applicants slide-over    (creatorId + participationId)
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/admin/Avatar";
import { getAdminToken } from "@/lib/auth";
import { getCreatorRichDetail, updateApplicantStatusSafe } from "@/lib/admin-rich";
import type { CreatorRichDetail, GemstoneRank } from "@/lib/api";
import { RankBadge, nextRankInfo } from "@/components/gamification/RankBadge";
import { XpBar } from "@/components/gamification/XpBar";
import { StreakFlame } from "@/components/gamification/StreakFlame";
import { AwardRow } from "@/components/gamification/AwardBadge";

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸", USA: "🇺🇸", GB: "🇬🇧", UK: "🇬🇧", CA: "🇨🇦", AU: "🇦🇺", DE: "🇩🇪", FR: "🇫🇷",
  IN: "🇮🇳", BR: "🇧🇷", MX: "🇲🇽", NG: "🇳🇬", PH: "🇵🇭", ID: "🇮🇩", PK: "🇵🇰", BD: "🇧🇩",
  ES: "🇪🇸", IT: "🇮🇹", NL: "🇳🇱", JP: "🇯🇵", KR: "🇰🇷", ZA: "🇿🇦",
};

function flagFor(country: string | null): string {
  if (!country) return "🌐";
  return COUNTRY_FLAGS[country.trim().toUpperCase()] ?? "🌐";
}

function fmtNumber(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  if (!Number.isFinite(v)) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

function fmtMoney(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  return `$${Number.isFinite(v) ? v.toFixed(2) : "0.00"}`;
}

const PLATFORM_GRADIENT: Record<string, string> = {
  tiktok: "linear-gradient(135deg,#25F4EE33,#FE2C5533)",
  instagram: "linear-gradient(135deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)",
  youtube: "linear-gradient(135deg,#ff000055,#28282855)",
  x: "linear-gradient(135deg,#00000055,#33333355)",
  twitter: "linear-gradient(135deg,#1DA1F255,#0d8ecf55)",
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-center">
      <p className="text-lg font-semibold text-[var(--color-text)]">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}

export function CreatorDetailCard({
  creatorId,
  participationId,
  compact = false,
}: {
  creatorId: string;
  participationId?: string;
  compact?: boolean;
}) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => setToken(getAdminToken()), []);

  const q = useQuery({
    queryKey: ["admin-creator-rich", creatorId],
    queryFn: () => getCreatorRichDetail(token ?? "", creatorId),
    enabled: !!token && !!creatorId,
    retry: false,
  });

  const [busy, setBusy] = useState<"bookmark" | "decline" | null>(null);
  async function act(action: "bookmark" | "decline") {
    if (!participationId) return;
    setBusy(action);
    try {
      await updateApplicantStatusSafe(participationId, action === "bookmark" ? "bookmarked" : "declined");
    } finally {
      setBusy(null);
    }
  }

  if (q.isLoading || !q.data) {
    return <p className="text-sm text-[var(--color-text-secondary)]">Loading creator…</p>;
  }

  const c: CreatorRichDetail = q.data;
  const rank = (c.rank ?? "bronze") as GemstoneRank | string;

  return (
    <div className="space-y-6">
      {/* 1. Hero row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Avatar url={c.avatar_url} name={c.display_name ?? c.email} size={compact ? 72 : 128} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={compact ? "text-xl font-semibold text-[var(--color-text)]" : "text-3xl font-semibold text-[var(--color-text)]"}>
                {c.display_name ?? "Unnamed creator"}
              </h2>
              <span className="text-xl leading-none">{flagFor(c.country)}</span>
              <RankBadge rank={rank} />
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {[c.age ? `${c.age}` : null, c.gender ? c.gender.replace(/_/g, " ") : null, c.city || c.country].filter(Boolean).join(" • ") || "—"}
            </p>
            {c.education ? (
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{c.education.replace(/_/g, " ")}</p>
            ) : null}
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{c.email}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            disabled={!participationId || busy !== null}
            onClick={() => act("bookmark")}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "bookmark" ? "Saving…" : "Bookmark"}
          </button>
          <button
            disabled
            title="Messaging is managed from the Applicants tab"
            className="cursor-not-allowed rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] opacity-60"
          >
            Send Message
          </button>
          <button
            disabled={!participationId || busy !== null}
            onClick={() => act("decline")}
            className="rounded-lg border border-[var(--color-danger)]/40 px-3 py-1.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "decline" ? "Saving…" : "Decline"}
          </button>
        </div>
      </div>

      {c.bio ? <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{c.bio}</p> : null}

      {/* 2. Stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Views" value={fmtNumber(c.total_views)} />
        <StatCard label="Earned" value={fmtMoney(c.total_earned)} />
        <StatCard label="Posts" value={String(c.total_posts)} />
        <StatCard label="Streak" value={`${c.streak_days}d`} />
      </div>

      {/* 2b. XP progress + streak flame (Feature 7 shared components) */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <XpBar xp={c.xp} xpToNext={nextRankInfo(c.xp).xpToNext} nextRank={nextRankInfo(c.xp).nextRank} />
        </div>
        <StreakFlame days={c.streak_days} />
      </div>

      {/* 3. Recent videos reel */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Recent videos</h3>
        {c.recent_submissions.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No videos submitted yet.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {c.recent_submissions.map((v) => (
              <a
                key={v.id}
                href={v.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-[9/16] w-28 shrink-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] sm:w-32"
              >
                {v.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div
                    className="h-full w-full"
                    style={{ background: PLATFORM_GRADIENT[v.platform] ?? "linear-gradient(135deg,#22c55e33,#05261533)" }}
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white">▶</span>
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 text-[10px] text-white">
                  <span>❤ {fmtNumber(v.likes)}</span>
                  <span className="ml-2">💬 {fmtNumber(v.comments)}</span>
                  <span className="ml-2">↗ {fmtNumber(v.shares ?? 0)}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* 4. Socials */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Socials</h3>
        {c.socials.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No social accounts.</p>
        ) : (
          <ul className="space-y-2">
            {c.socials.map((s, i) => (
              <li
                key={`${s.platform}-${s.handle}-${i}`}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
              >
                <span className="text-[var(--color-text)]">
                  <span className="text-[var(--color-text-muted)]">{s.platform}</span> · @{s.handle} ·{" "}
                  <span className="tabular">{fmtNumber(s.follower_count)}</span> followers
                </span>
                {s.profile_url ? (
                  <a href={s.profile_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-brand)] underline">
                    Open ↗
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 5. Awards */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Awards</h3>
        <AwardRow awards={c.awards} />
      </section>

      {/* 6. Experiences */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Experience</h3>
        {c.experiences.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No experience listed.</p>
        ) : (
          <ul className="space-y-2">
            {c.experiences.map((e) => (
              <li key={e.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text)]">
                <span className="font-medium">{e.title}</span>
                {e.org ? <span className="text-[var(--color-text-secondary)]"> @ {e.org}</span> : null}
                {e.url ? (
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-[var(--color-brand)] underline">
                    Link ↗
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 7. Content niches */}
      {c.niches.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Content niches</h3>
          <div className="flex flex-wrap gap-1.5">
            {c.niches.map((n) => (
              <span key={n} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
                {n}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
