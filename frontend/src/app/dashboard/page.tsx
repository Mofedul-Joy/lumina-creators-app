"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CreatorNav } from "@/components/creator/CreatorNav";
import { getAuthToken } from "@/lib/auth";
import { getCompletion, getProfile, isAuthError } from "@/lib/api";
import { browseCampaigns, listSubmissions } from "@/lib/campaigns";
import { fmtInt, fmtMoney } from "@/lib/format";

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
  const completionQ = useQuery({ queryKey: ["completion"], queryFn: () => getCompletion(bearer), enabled, retry: false });
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => getProfile(bearer), enabled, retry: false });
  const subsQ = useQuery({ queryKey: ["submissions"], queryFn: listSubmissions, enabled, retry: false });
  const campaignsQ = useQuery({ queryKey: ["campaigns"], queryFn: browseCampaigns, enabled, retry: false });

  useEffect(() => {
    if (completionQ.data && !completionQ.data.completed) router.replace("/onboarding");
  }, [completionQ.data, router]);
  useEffect(() => {
    if (completionQ.isError && isAuthError(completionQ.error)) router.replace("/login");
  }, [completionQ.isError, completionQ.error, router]);

  if (!ready || !token || completionQ.isLoading || !completionQ.data?.completed)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );

  const subs = subsQ.data ?? [];
  const campaigns = campaignsQ.data ?? [];
  const nameById = new Map(campaigns.map((c) => [c.id, c.name]));
  const joinedCount = campaigns.filter((c) => c.joined).length;
  const totals = subs.reduce(
    (acc, s) => ({ views: acc.views + s.views, earnings: acc.earnings + Number(s.estimated_amount) }),
    { views: 0, earnings: 0 },
  );
  const firstName = (profileQ.data?.display_name ?? "").trim().split(" ")[0] || "creator";

  return (
    <div className="min-h-[100dvh]">
      <CreatorNav />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Creator workspace</p>
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
    </div>
  );
}
