"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AddCreatorsToCampaignModal } from "@/components/admin/AddCreatorsToCampaignModal";
import { CampaignExamplesSection } from "@/components/admin/CampaignExamplesSection";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  convertCampaignToAdvanced,
  getAdminCampaign,
  getCampaignInviteLink,
  getCampaignOverview,
  type CampaignOverviewCreator,
} from "@/lib/admin";
import { getAdminToken } from "@/lib/auth";
import { isAuthError } from "@/lib/api";
import { campaignImage } from "@/lib/campaignTheme";
import { kindLabel, scheduleLabel } from "@/lib/campaignFlow";
import { fmtInt, fmtMoney } from "@/lib/format";

function ToolbarButton({
  onClick,
  href,
  children,
  primary,
}: {
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  const cls = `inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium transition ${
    primary
      ? "bg-[var(--color-brand)] text-[var(--color-on-brand)] hover:bg-[var(--color-brand-hover)]"
      : "border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-brand)]"
  }`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button onClick={onClick} className={cls}>{children}</button>;
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card-grad rounded-[var(--radius-card)] p-4">
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="tabular mt-1.5 text-2xl font-semibold text-[var(--color-text)]">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{sub}</p> : null}
    </div>
  );
}

function CreatorRow({ c }: { c: CampaignOverviewCreator }) {
  const initials = (c.display_name || "?").trim().slice(0, 1).toUpperCase();
  return (
    <Link
      href={`/admin/creators/${c.creator_id}`}
      className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 transition hover:border-[var(--color-brand)]"
    >
      {c.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.avatar_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-surface)] text-sm font-semibold text-[var(--color-text-muted)]">
          {initials}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-text)]">{c.display_name}</p>
        <p className="text-xs capitalize text-[var(--color-text-muted)]">{c.status}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="tabular text-sm text-[var(--color-text)]">{fmtInt(c.posts)} posts</p>
        <p className="tabular text-xs text-[var(--color-text-muted)]">{fmtInt(c.views)} views</p>
      </div>
    </Link>
  );
}

export default function CampaignDetailPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  useEffect(() => {
    setToken(getAdminToken());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !token) router.replace("/admin/login");
  }, [ready, token, router]);

  const campQ = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => getAdminCampaign(id),
    enabled: ready && !!token && !!id,
    retry: false,
  });
  const ovQ = useQuery({
    queryKey: ["campaign-overview", id],
    queryFn: () => getCampaignOverview(id),
    enabled: ready && !!token && !!id,
    retry: false,
  });
  useEffect(() => {
    if (campQ.isError && isAuthError(campQ.error)) router.replace("/admin/login");
  }, [campQ.isError, campQ.error, router]);

  const convert = useMutation({
    mutationFn: () => convertCampaignToAdvanced(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign", id] }),
  });

  const c = campQ.data;

  async function copyInviteLink() {
    if (!c) return;
    // Backend-minted reusable link — a signup URL that auto-joins this campaign.
    const { link } = await getCampaignInviteLink(id);
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (!ready || !token || campQ.isLoading) {
    return (
      <div className="min-h-[100dvh]">
        <AdminShell />
        <main className="mx-auto max-w-6xl px-6 py-10">
          <Skeleton className="h-8 w-64" />
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        </main>
      </div>
    );
  }

  if (!c) {
    return (
      <div className="min-h-[100dvh]">
        <AdminShell />
        <main className="mx-auto max-w-6xl px-6 py-10">
          <p className="text-sm text-[var(--color-danger)]">Campaign not found.</p>
          <Link href="/admin/campaigns" className="mt-4 inline-block text-sm text-[var(--color-brand)] underline">
            Back to campaigns
          </Link>
        </main>
      </div>
    );
  }

  const ov = ovQ.data;
  const level = c.experience_level ?? "essentials";

  const payLine = (() => {
    switch (c.payment_type) {
      case "fixed":
        return `${fmtMoney(c.fixed_amount ?? 0)} every ${c.posts_per_payment ?? 1} post(s)`;
      case "cpm":
        return `${fmtMoney(c.cpm_rate)} / 1,000 views`;
      case "mixed":
        return `${fmtMoney(c.fixed_amount ?? 0)} + ${fmtMoney(c.cpm_rate)} / 1,000 views`;
      case "per_hour":
        return `${fmtMoney(c.hourly_rate ?? 0)} / hr · ${c.required_hours ?? 0} hrs`;
      case "per_post":
        return `${fmtMoney(c.per_post_amount ?? 0)} / post`;
      default:
        return `${fmtMoney(c.cpm_rate)} / 1,000 views`;
    }
  })();

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton href="/admin/campaigns">← All campaigns</ToolbarButton>
          <div className="flex-1" />
          <ToolbarButton href={`/admin/campaigns/${id}/edit`}>Edit campaign</ToolbarButton>
          <ToolbarButton href={`/admin/campaigns/${id}/contract`}>Edit contract</ToolbarButton>
          {level !== "advanced" ? (
            <ToolbarButton onClick={() => convert.mutate()}>
              {convert.isPending ? "Converting…" : "Convert to Advanced"}
            </ToolbarButton>
          ) : null}
          <ToolbarButton onClick={copyInviteLink}>{copied ? "Copied" : "Copy invite link"}</ToolbarButton>
          <ToolbarButton onClick={() => setAddOpen(true)} primary>Add creators</ToolbarButton>
          <ToolbarButton href="/admin/analytics">View analytics</ToolbarButton>
        </div>

        <AdminTabs />

        {/* header */}
        <div className="flex flex-wrap items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={campaignImage(c)}
            alt=""
            className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-[var(--color-border)]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">{c.name}</h1>
              <StatusBadge status={c.status} />
              <span className="rounded-full bg-[var(--color-brand)]/15 px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-brand)] capitalize">
                {level}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {kindLabel(c.campaign_kind ?? "high_volume_ugc")}
              {c.brand_name ? ` · ${c.brand_name}` : ""}
            </p>
          </div>
        </div>

        {/* stat tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
          <StatTile label="Active creators" value={fmtInt(ov?.active_creators ?? 0)} sub={`${fmtInt(ov?.delivered_creators ?? 0)} delivered`} />
          <StatTile label="Pending invites" value={fmtInt(ov?.pending_invites ?? 0)} sub="Awaiting response" />
          <StatTile label="Active contracts" value={fmtInt(ov?.active_contracts ?? 0)} sub="Signed agreements" />
          <StatTile label="Total posts" value={fmtInt(ov?.total_posts ?? 0)} />
          <StatTile label="Total views" value={fmtInt(ov?.total_views ?? 0)} />
          <StatTile label="Total spend" value={fmtMoney(ov?.total_spend ?? 0)} sub="Paid to date" />
          <StatTile label="Budget" value={fmtMoney(c.budget)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* campaign details */}
          <section className="card-grad rounded-[var(--radius-card)] p-5 space-y-4">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Campaign details</h2>
            <div className="divide-y divide-[var(--color-border)]">
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="text-sm text-[var(--color-text-secondary)]">Status</span>
                <StatusBadge status={c.status} />
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="text-sm text-[var(--color-text-secondary)]">Start date</span>
                <span className="text-sm text-[var(--color-text)]">{fmtDate(c.starts_at) ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="text-sm text-[var(--color-text-secondary)]">End date</span>
                <span className="text-sm text-[var(--color-text)]">{fmtDate(c.ends_at) ?? "Ongoing"}</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="text-sm text-[var(--color-text-secondary)]">Pay</span>
                <span className="text-sm text-[var(--color-text)]">{payLine}</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="text-sm text-[var(--color-text-secondary)]">Platforms</span>
                <span className="text-sm text-[var(--color-text)]">
                  {c.no_platform_tracking ? "No platform tracking" : (c.platforms ?? []).join(", ") || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="text-sm text-[var(--color-text-secondary)]">Payment schedule</span>
                <span className="text-sm text-[var(--color-text)]">{scheduleLabel(c.payment_schedule ?? null)}</span>
              </div>
            </div>
            {c.description ? (
              <div className="border-t border-[var(--color-border)] pt-4">
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Description</p>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-[var(--color-text-secondary)]">
                  {c.description}
                </p>
              </div>
            ) : null}
          </section>

          {/* example videos */}
          <CampaignExamplesSection campaignId={id} />

          {/* active creators */}
          <section className="card-grad rounded-[var(--radius-card)] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Active creators</h2>
              <span className="text-xs text-[var(--color-text-muted)]">{fmtInt(ov?.active_creators ?? 0)}</span>
            </div>
            <div className="mt-3 space-y-2">
              {ovQ.isLoading ? (
                <Skeleton className="h-14 w-full" />
              ) : (ov?.creators ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-secondary)]">
                  No active creators yet.
                  <button onClick={() => setAddOpen(true)} className="mt-1 block w-full cursor-pointer text-[var(--color-brand)] underline">
                    Add creators
                  </button>
                </div>
              ) : (
                (ov?.creators ?? []).map((cr) => <CreatorRow key={cr.creator_id} c={cr} />)
              )}
            </div>
          </section>
        </div>
      </main>

      <AddCreatorsToCampaignModal
        open={addOpen}
        campaignId={id}
        onClose={() => setAddOpen(false)}
        onInvited={() => ovQ.refetch()}
      />
    </div>
  );
}
