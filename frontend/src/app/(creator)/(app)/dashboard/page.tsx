"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth";
import { getProfile, isAuthError } from "@/lib/api";
import { listSubmissions } from "@/lib/campaigns";
import { getMyGamification } from "@/lib/gamification";
import { fmtMoney } from "@/lib/format";
import { Skeleton } from "@/components/ui/Skeleton";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
// First unmet earnings milestone — drives the "what you've earned" progress bar.
const MILESTONES = [1, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

export default function DashboardPage() {
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
  const subsQ = useQuery({ queryKey: ["submissions"], queryFn: listSubmissions, enabled, retry: false });
  const gamQ = useQuery({ queryKey: ["my-gamification"], queryFn: getMyGamification, enabled, retry: false });
  useEffect(() => {
    if (profileQ.isError && isAuthError(profileQ.error)) router.replace("/login");
  }, [profileQ.isError, profileQ.error, router]);

  if (!ready || !token || profileQ.isLoading)
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Skeleton className="h-4 w-40" />
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      </main>
    );

  const subs = subsQ.data ?? [];
  const earned = subs.reduce((acc, s) => acc + Number(s.estimated_amount), 0);
  const goal = MILESTONES.find((m) => m > earned) ?? Math.ceil((earned + 1) / 1000) * 1000;
  const pct = goal > 0 ? Math.min(100, (earned / goal) * 100) : 0;

  const streak = gamQ.data?.streak_days ?? 0;
  const firstName = (profileQ.data?.display_name ?? "").trim().split(" ")[0] || "creator";

  const today = new Date().getDay(); // 0 Sun … 6 Sat
  // Light the last `streak` days (capped to a week), wrapping across Sunday so a
  // streak that began before this week still shows a flame on every day.
  const litDays = Math.min(streak, 7);
  const dayActive = (d: number) => streak > 0 && (today - d + 7) % 7 < litDays;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <p className="text-sm text-[var(--color-text-secondary)]">Welcome back, {firstName}</p>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {/* What you've earned */}
        <section className="card-lumina rounded-[var(--radius-card)] p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">What you&apos;ve earned</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
              <span aria-hidden>🎯</span> {fmtMoney(goal)}
            </span>
          </div>
          <p className="tabular mt-3 text-4xl font-semibold text-[var(--color-brand-soft)]">{fmtMoney(earned)}</p>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-brand-soft)] transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            {earned > 0 ? `${fmtMoney(goal - earned)} to your next milestone` : "Enter a campaign and post to start earning on your views."}
          </p>
        </section>

        {/* Days streak */}
        <section className="card-lumina rounded-[var(--radius-card)] p-6">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--color-brand)]/12 text-3xl" aria-hidden>🔥</span>
            <div>
              <p className="tabular text-3xl font-semibold text-[var(--color-text)]">{streak}</p>
              <p className="text-sm font-medium text-[var(--color-brand-soft)]">days streak!</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-1.5">
            {DAYS.map((label, d) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <span className="text-[11px] text-[var(--color-text-muted)]">{label}</span>
                <span
                  className={`grid h-9 w-full place-items-center rounded-lg text-xs font-semibold transition ${
                    dayActive(d)
                      ? "bg-[var(--color-brand)]/20 text-[var(--color-brand-soft)]"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                  } ${d === today ? "ring-2 ring-[var(--color-brand)]" : ""}`}
                >
                  {dayActive(d) ? "🔥" : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
