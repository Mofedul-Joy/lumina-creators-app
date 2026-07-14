"use client";

// Public, no-login client report (Feature 6, BUILD_SPEC.md §3.7). Gated by a
// high-entropy share_token in the URL — never requires auth, never shows
// creator PII (only display_name + avatar_url), never paywalled.
import { retryNonAuth } from "@/lib/api";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { getPublicReport } from "@/lib/public";
import { fmtInt } from "@/lib/format";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold text-[var(--color-text)]">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
      {label}
    </span>
  );
}

export default function PublicReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const q = useQuery({
    queryKey: ["public-report", token],
    queryFn: () => getPublicReport(token),
    retry: retryNonAuth,
  });

  const r = q.data;
  const generatedAt = new Date();

  return (
    <main className="mx-auto min-h-[100dvh] max-w-5xl px-6 py-10">
      {q.isLoading ? (
        <p className="mt-10 text-center text-sm text-[var(--color-text-muted)]">Loading report…</p>
      ) : q.isError || !r ? (
        <div className="mt-16 text-center">
          <p className="text-lg font-semibold text-[var(--color-text)]">Report not found</p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            This link may have been disabled or rotated. Ask your Lumina Creators contact for a fresh link.
          </p>
        </div>
      ) : (
        <>
          {/* Banner hero */}
          {r.banner_url ? (
            <div className="relative mt-2 aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface-2)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.banner_url} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg-deep)] via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 p-5">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">{r.brand_name ?? "Lumina campaign"}</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-text)] drop-shadow">{r.name}</h1>
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              {!r.banner_url ? (
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">{r.name}</h1>
              ) : null}
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-[var(--color-text-secondary)]">{r.brand_name ?? "Lumina campaign"}</span>
                <StatusBadge status={r.status} />
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">Performance report</p>
          </div>

          {/* Stat tiles */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Total views" value={fmtInt(r.total_views)} />
            <StatTile label="Total likes" value={fmtInt(r.total_likes)} />
            <StatTile label="Total comments" value={fmtInt(r.total_comments)} />
            <StatTile label="Engagement rate" value={`${(r.engagement_rate * 100).toFixed(1)}%`} />
            <StatTile label="Submissions" value={fmtInt(r.submission_count)} />
            <StatTile label="Creators" value={fmtInt(r.creator_count)} />
          </div>

          {/* Submissions grid */}
          <div className="mt-10">
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Submissions</h2>
            {r.submissions.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No submissions yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {r.submissions.map((s) => (
                  <a
                    key={s.id}
                    href={s.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="card-lumina block overflow-hidden rounded-[var(--radius-card)] transition hover:-translate-y-0.5"
                  >
                    <div className="relative aspect-video w-full bg-[var(--color-surface-2)]">
                      {s.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.thumbnail_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--color-brand)]/20 to-[var(--color-bg-deep)]">
                          <PlatformIcon name={s.platform} className="h-8 w-8 text-[var(--color-brand-soft)]" />
                        </div>
                      )}
                      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-[var(--color-text)] backdrop-blur">
                        <PlatformIcon name={s.platform} className="h-3 w-3" />
                        {platformLabel(s.platform)}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2">
                        {s.creator_avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.creator_avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[10px] text-[var(--color-text-muted)]">
                            {(s.creator_display_name ?? "?").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate text-sm text-[var(--color-text)]">{s.creator_display_name ?? "Creator"}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                        <span>{fmtInt(s.views)} views</span>
                        <span>{fmtInt(s.likes)} likes</span>
                        <span>{fmtInt(s.comments)} comments</span>
                      </div>
                      <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                        {new Date(s.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="mt-14 flex flex-col items-center gap-1 border-t border-[var(--color-border)] pt-6 pb-4 text-center">
            <p className="text-xs font-medium text-[var(--color-text-secondary)]">
              Powered by <span className="text-[var(--color-brand-soft)]">Lumina Creators</span>
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">Report generated {generatedAt.toLocaleString()}</p>
          </footer>
        </>
      )}
    </main>
  );
}
