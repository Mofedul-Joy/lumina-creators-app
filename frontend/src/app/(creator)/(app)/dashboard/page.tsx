"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth";
import { getProfile, isAuthError } from "@/lib/api";
import { browseCampaigns, listSubmissions } from "@/lib/campaigns";
import { fmtInt, fmtMoney } from "@/lib/format";
import { Skeleton, SkeletonStats } from "@/components/ui/Skeleton";
import { GamificationHero } from "@/components/gamification/GamificationHero";

const STATUS_STYLE: Record<string, string> = {
  approved: "border-[var(--color-brand)]/40 text-[var(--color-brand)]",
  pending: "border-[var(--color-border)] text-[var(--color-text-muted)]",
  rejected: "border-[var(--color-danger)]/40 text-[var(--color-danger)]",
};

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="card-grad rounded-[var(--radius-card)] p-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
      <p className={`tabular mt-3 text-3xl font-semibold ${accent ? "text-[var(--color-brand-soft)]" : "text-[var(--color-text)]"}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{hint}</p> : null}
    </div>
  );
}

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
  const campaignsQ = useQuery({ queryKey: ["campaigns"], queryFn: browseCampaigns, enabled, retry: false });
  useEffect(() => {
    if (profileQ.isError && isAuthError(profileQ.error)) router.replace("/login");
  }, [profileQ.isError, profileQ.error, router]);

  if (!ready || !token || profileQ.isLoading)
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-10 w-72" />
        <div className="mt-8"><SkeletonStats count={4} /></div>
        <Skeleton className="mt-8 h-6 w-40" />
        <Skeleton className="mt-3 h-64 w-full" />
      </main>
    );

  const subs = subsQ.data ?? [];
  const campaigns = campaignsQ.data ?? [];
  const nameById = new Map(campaigns.map((c) => [c.id, c.name]));
  const modeById = new Map(campaigns.map((c) => [c.id, c.mode]));
  const joinedCount = campaigns.filter((c) => c.joined).length;
  const totals = subs.reduce(
    (acc, s) => ({ views: acc.views + s.views, earnings: acc.earnings + Number(s.estimated_amount) }),
    { views: 0, earnings: 0 },
  );
  const firstName = (profileQ.data?.display_name ?? "").trim().split(" ")[0] || "creator";

  // Incentive cards — no forced gate, just prompts. Proof video only applies
  // to create_new campaigns (copy_paste has nothing to prove).
  const needsProofCount = subs.filter((s) => modeById.get(s.campaign_id) === "create_new" && !s.has_proof_video).length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Lumina Creators</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Welcome back, {firstName}</h1>
      <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
        Enter campaigns, post to your socials, and earn on every verified view.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/campaigns"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] shadow-[0_0_20px_-4px_rgba(34,197,94,0.7)] transition hover:bg-[var(--color-brand-hover)]"
        >
          Browse campaigns
        </Link>
        <Link
          href="/onboarding"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--color-border)] px-5 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-text-muted)]"
        >
          Edit profile
        </Link>
      </div>

      {/* Gamification hero strip (Feature 7): rank + XP bar + streak + awards */}
      <div className="mt-6">
        <GamificationHero enabled={enabled} />
      </div>

      {/* incentive cards — prompts, never gates */}
      {needsProofCount > 0 ? (
        <Link
          href="/submissions"
          className="card-interactive mt-6 flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-[var(--color-bg-deep)] p-5"
        >
          <div>
            <p className="text-sm font-semibold text-amber-400">
              {needsProofCount} clip{needsProofCount === 1 ? "" : "s"} need{needsProofCount === 1 ? "s" : ""} a proof video
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Upload a quick screen-recording of your post&apos;s analytics so we can verify and pay out.
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium text-amber-400">Upload now →</span>
        </Link>
      ) : null}

      {/* Portfolio upload — deliberately the loudest card on the page: full brand
          fill + video icon, to pull creators into uploading a portfolio video. */}
      <Link
        href="/onboarding?tab=portfolio"
        className="card-interactive mt-6 flex items-center justify-between gap-4 rounded-[var(--radius-card)] bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-brand-hover)] p-6 shadow-[0_0_28px_-8px_rgba(34,197,94,0.7)]"
      >
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black/20 text-[var(--color-on-brand)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="2" /><path d="M16 10l6-3v10l-6-3v-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
          </span>
          <div>
            <p className="text-base font-bold text-[var(--color-on-brand)]">Upload a portfolio video</p>
            <p className="mt-1 text-sm text-[var(--color-on-brand)]/85">
              Show brands your best work. Creators with a portfolio get matched to more (and higher-paying) campaigns.
            </p>
          </div>
        </div>
        <span className="hidden shrink-0 items-center gap-1 rounded-full bg-black/25 px-4 py-2 text-sm font-semibold text-[var(--color-on-brand)] sm:inline-flex">
          Upload now →
        </span>
      </Link>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Est. earnings" value={fmtMoney(totals.earnings)} hint="from verified views" accent />
        <StatCard label="Total views" value={fmtInt(totals.views)} hint="across your posts" />
        <StatCard label="Submissions" value={fmtInt(subs.length)} hint={`${joinedCount} campaign${joinedCount === 1 ? "" : "s"} joined`} />
        <StatCard label="Available campaigns" value={fmtInt(campaigns.length)} hint="live right now" />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Recent submissions</h2>
        <Link href="/submissions" className="text-sm text-[var(--color-brand)] hover:underline">View all →</Link>
      </div>
      <div className="card-lumina mt-3 rounded-[var(--radius-card)]">
        {subsQ.isLoading ? (
          <p className="p-6 text-sm text-[var(--color-text-muted)]">Loading…</p>
        ) : subs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[var(--color-text)]">No submissions yet</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Enter a campaign and post to start earning.</p>
            <Link
              href="/campaigns"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-brand)] px-4 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
            >
              Browse campaigns
            </Link>
          </div>
        ) : (
          <ul>
            {subs.slice(0, 6).map((s, i) => (
              <li
                key={s.id}
                className={`flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-150 hover:bg-[var(--color-surface)]/50 ${
                  i > 0 ? "border-t border-[var(--color-border)]" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--color-text)]">{nameById.get(s.campaign_id) ?? "Campaign"}</p>
                  <a href={s.post_url} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-xs text-[var(--color-brand)] hover:underline">
                    {s.platform} ↗
                  </a>
                </div>
                <div className="flex shrink-0 items-center gap-5 text-right">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Views</p>
                    <p className="tabular text-sm text-[var(--color-text)]">{fmtInt(s.views)}</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Est.</p>
                    <p className="tabular text-sm text-[var(--color-text)]">{fmtMoney(s.estimated_amount)}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs capitalize ${
                      STATUS_STYLE[s.verification_status] ?? "border-[var(--color-border)] text-[var(--color-text-muted)]"
                    }`}
                  >
                    {s.verification_status.replace(/_/g, " ")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
