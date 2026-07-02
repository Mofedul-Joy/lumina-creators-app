"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreatorNav } from "@/components/creator/CreatorNav";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { getAuthToken } from "@/lib/auth";
import { getCampaign, joinCampaign, submitClip } from "@/lib/campaigns";
import { fmtMoney } from "@/lib/format";

export default function CampaignDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const qc = useQueryClient();
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => setHasToken(!!getAuthToken()), []);
  const [postUrl, setPostUrl] = useState("");

  const q = useQuery({ queryKey: ["campaign", slug], queryFn: () => getCampaign(slug), enabled: hasToken, retry: false });

  const join = useMutation({
    mutationFn: () => joinCampaign(slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign", slug] }),
  });
  const submit = useMutation({
    mutationFn: () => submitClip(slug, postUrl.trim()),
    onSuccess: () => setPostUrl(""),
  });

  const c = q.data;

  return (
    <div className="min-h-[100dvh]">
      <CreatorNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/campaigns" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
          ← All campaigns
        </Link>

        {!hasToken ? (
          <p className="mt-6 text-[var(--color-text-secondary)]">
            Please <Link href="/login" className="text-[var(--color-brand)] underline">sign in</Link> to view this campaign.
          </p>
        ) : q.isLoading ? (
          <p className="mt-6 text-[var(--color-text-muted)]">Loading…</p>
        ) : q.isError || !c ? (
          <p className="mt-6 text-[var(--color-danger)]">{(q.error as Error)?.message ?? "Campaign not found."}</p>
        ) : (
          <>
            <div className="mt-5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--color-text-secondary)]">{c.brand_name ?? "Lumina campaign"}</span>
                <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
                  {c.mode === "create_new" ? "Create new content" : "Repost approved clips"}
                </span>
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-text)]">{c.name}</h1>
              {c.description ? <p className="mt-2 text-[var(--color-text-secondary)]">{c.description}</p> : null}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="CPM" value={fmtMoney(c.cpm_rate)} />
              <Stat label="Budget" value={fmtMoney(c.budget)} />
              <Stat label="Min. retention" value={`${c.min_retention_days}d`} />
              <Stat label="Platforms" value={String(c.platforms.length)} />
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.platforms.map((p) => (
                <span key={p} className="rounded-md bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">{p}</span>
              ))}
            </div>

            {/* mode-specific content */}
            {c.mode === "create_new" && c.brief_script ? (
              <Panel title="Your brief">
                <p className="whitespace-pre-wrap text-[var(--color-text-secondary)]">{c.brief_script}</p>
              </Panel>
            ) : null}
            {c.mode === "copy_paste" && c.content_drive_url ? (
              <Panel title="Approved clips">
                <p className="text-[var(--color-text-secondary)]">Download a clip from the campaign folder and post it to your socials.</p>
                <a href={c.content_drive_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-[var(--color-brand)] underline">
                  Open clips folder ↗
                </a>
              </Panel>
            ) : null}
            {c.caption_rules ? (
              <Panel title="Caption rules">
                <p className="whitespace-pre-wrap text-[var(--color-text-secondary)]">{c.caption_rules}</p>
              </Panel>
            ) : null}
            {c.required_mentions.length > 0 ? (
              <Panel title="Must mention">
                <p className="text-[var(--color-text-secondary)]">{c.required_mentions.join(", ")}</p>
              </Panel>
            ) : null}

            {/* join / submit */}
            <div className="mt-8 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
              {!c.joined ? (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-[var(--color-text-secondary)]">Enter this campaign to start submitting your posts.</p>
                  <div className="w-44">
                    <Button loading={join.isPending} onClick={() => join.mutate()}>Enter campaign</Button>
                  </div>
                  {join.isError ? (
                    (join.error as Error).message === "profile_incomplete" ? (
                      <p className="text-sm text-[var(--color-warning)]">
                        Finish your profile before entering campaigns.{" "}
                        <Link href="/onboarding" className="text-[var(--color-brand)] underline">
                          Complete profile
                        </Link>
                      </p>
                    ) : (
                      <p className="text-sm text-[var(--color-danger)]">{(join.error as Error).message}</p>
                    )
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-[var(--color-brand)]">You’re in this campaign — submit your post URL.</p>
                  <Field
                    label="Post URL"
                    placeholder="https://tiktok.com/@you/video/…"
                    value={postUrl}
                    onChange={(e) => setPostUrl(e.target.value)}
                  />
                  <div className="w-44">
                    <Button loading={submit.isPending} disabled={!postUrl.trim()} onClick={() => submit.mutate()}>
                      Submit post
                    </Button>
                  </div>
                  {submit.isError ? <p className="text-sm text-[var(--color-danger)]">{(submit.error as Error).message}</p> : null}
                  {submit.isSuccess ? <p className="text-sm text-[var(--color-brand)]">Submitted — we’ll track the views.</p> : null}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="tabular text-lg font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{title}</h2>
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">{children}</div>
    </div>
  );
}
