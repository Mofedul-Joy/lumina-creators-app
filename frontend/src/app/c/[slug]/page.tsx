"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { ApiError, publicApi } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { Skeleton } from "@/components/ui/Skeleton";

const MODE_LABEL = { create_new: "Create new content", copy_paste: "Repost approved clips" } as const;

export default function CampaignEntryPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [email, setEmail] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [error, setError] = useState("");

  const q = useQuery({ queryKey: ["public-campaign", slug], queryFn: () => publicApi.campaign(slug) });

  const submitM = useMutation({
    mutationFn: () => publicApi.submit(slug, { email: email.trim(), post_url: postUrl.trim() }),
    onSuccess: () => router.push(`/c/${slug}/success?email=${encodeURIComponent(email.trim())}`),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Something went wrong. Try again."),
  });

  if (q.isLoading)
    return (
      <main className="mx-auto grid max-w-5xl gap-6 px-6 py-10 lg:grid-cols-[1fr_380px]">
        <div>
          <Skeleton className="h-48 w-full" />
          <Skeleton className="mt-4 h-4 w-24" />
          <Skeleton className="mt-2 h-8 w-2/3" />
          <Skeleton className="mt-4 h-24 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </main>
    );

  const c = q.data;
  if (!c)
    return (
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm text-[var(--color-danger)]">Campaign not found or no longer live.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-[var(--color-brand)] underline">← Back to campaigns</Link>
      </main>
    );

  return (
    <div className="min-h-[100dvh]">
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <Link href="/" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">← All campaigns</Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-6 py-10 lg:grid-cols-[1fr_380px]">
        <section>
          <div className="relative h-48 w-full overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-[var(--color-brand)]/30 to-[var(--color-bg-deep)]">
            {c.brand_logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.brand_logo_url} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <p className="mt-4 text-xs font-medium text-[var(--color-text-secondary)]">{c.brand_name ?? "Lumina campaign"}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--color-text)]">{c.name}</h1>
          {c.description ? <p className="mt-3 text-[var(--color-text-secondary)]">{c.description}</p> : null}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {c.platforms.map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-surface-2)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
                <PlatformIcon name={p} className="h-3.5 w-3.5" />
                {platformLabel(p)}
              </span>
            ))}
          </div>

          {c.requirements_url ? (
            <a
              href={c.requirements_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-brand)]/15 px-5 text-sm font-medium text-[var(--color-brand-soft)] transition hover:bg-[var(--color-brand)]/25"
            >
              View requirements
              <span aria-hidden>&rarr;</span>
            </a>
          ) : null}

          {c.mode === "create_new" && c.brief_script ? (
            <div className="card-lumina mt-6 rounded-[var(--radius-card)] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Brief / script</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{c.brief_script}</p>
            </div>
          ) : c.mode === "copy_paste" && c.content_drive_url ? (
            <div className="card-lumina mt-6 rounded-[var(--radius-card)] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Approved clips</h2>
              <a href={c.content_drive_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-[var(--color-brand)] hover:underline">Open clips folder ↗</a>
            </div>
          ) : null}

          {c.caption_rules ? (
            <div className="card-lumina mt-4 rounded-[var(--radius-card)] p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Caption rules</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{c.caption_rules}</p>
            </div>
          ) : null}
        </section>

        <aside className="lg:sticky lg:top-10 lg:self-start">
          <div className="card-lumina rounded-[var(--radius-card)] p-6">
            <div className="grid grid-cols-2 gap-4 border-b border-[var(--color-border)] pb-5">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">CPM rate</p>
                <p className="tabular text-xl font-semibold text-[var(--color-brand)]">{fmtMoney(c.cpm_rate)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Budget</p>
                <p className="tabular text-xl font-semibold text-[var(--color-text)]">{fmtMoney(c.budget)}</p>
              </div>
            </div>

            <h2 className="mt-5 text-lg font-semibold text-[var(--color-text)]">Submit your post</h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Enter your email and a link to your post, and we&apos;ll email you next steps.
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => { e.preventDefault(); setError(""); submitM.mutate(); }}
            >
              <input
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
              />
              <input
                type="url"
                required
                placeholder="Link to your post"
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
              />
              {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
              <button
                type="submit"
                disabled={submitM.isPending}
                className="min-h-11 w-full cursor-pointer rounded-full bg-[var(--color-brand)] text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:opacity-50"
              >
                {submitM.isPending ? "Submitting…" : "Submit post"}
              </button>
            </form>
          </div>
        </aside>
      </main>
    </div>
  );
}
