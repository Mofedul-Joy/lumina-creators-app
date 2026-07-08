// Shared hero strip: rank badge + XP bar + streak flame + award row (Feature 7).
// Used on the creator dashboard hero and the creator account gamification card.
"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyGamification } from "@/lib/gamification";
import { RankBadge } from "@/components/gamification/RankBadge";
import { XpBar } from "@/components/gamification/XpBar";
import { StreakFlame } from "@/components/gamification/StreakFlame";
import { AwardRow } from "@/components/gamification/AwardBadge";
import { Skeleton } from "@/components/ui/Skeleton";

export function GamificationHero({ enabled }: { enabled: boolean }) {
  const q = useQuery({ queryKey: ["my-gamification"], queryFn: getMyGamification, enabled, retry: false });

  if (q.isLoading || !q.data) {
    return (
      <div className="card-grad rounded-[var(--radius-card)] p-5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-4 h-2 w-full" />
        <Skeleton className="mt-4 h-10 w-full" />
      </div>
    );
  }

  const g = q.data;

  return (
    <div className="card-grad rounded-[var(--radius-card)] p-5">
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
        <AwardRow awards={g.awards} size="sm" />
      </div>
    </div>
  );
}

export default GamificationHero;
