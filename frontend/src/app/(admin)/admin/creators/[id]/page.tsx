"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { Avatar } from "@/components/admin/Avatar";
import { getAdminToken } from "@/lib/auth";
import { getCreatorDetail, isAuthError } from "@/lib/api";

const cardCls =
  "card-grad rounded-[var(--radius-card)] p-5 space-y-4";

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--color-border)] py-2 last:border-b-0">
      <dt className="text-sm text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-right text-sm text-[var(--color-text)]">{value ?? "—"}</dd>
    </div>
  );
}

export default function AdminCreatorDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setToken(getAdminToken());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && !token) router.replace("/admin/login");
  }, [ready, token, router]);

  const detailQ = useQuery({
    queryKey: ["admin-creator", id],
    queryFn: () => getCreatorDetail(token ?? "", id),
    enabled: ready && !!token && !!id,
    retry: false,
  });

  useEffect(() => {
    if (detailQ.isError && isAuthError(detailQ.error)) router.replace("/admin/login");
  }, [detailQ.isError, detailQ.error, router]);

  if (!ready || !token || detailQ.isLoading)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );

  const c = detailQ.data;
  if (!c)
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-[var(--color-danger)]">Creator not found.</p>
        <Link href="/admin/creators" className="mt-4 inline-block text-sm text-[var(--color-brand)] underline">
          Back to database
        </Link>
      </main>
    );

  return (
    <div className="min-h-[100dvh]">
      <AdminNav />
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
      <Link href="/admin/creators" className="text-sm text-[var(--color-brand)] underline">
        ← Back to database
      </Link>

      {/* Sideshift-style profile hero: identity, location, socials as buttons */}
      <header className="card-grad rounded-[var(--radius-card)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-5">
            <Avatar url={c.avatar_url} name={c.display_name} size={88} />
            <div>
              <h1 className="text-3xl font-semibold text-[var(--color-text)]">
                {c.display_name ?? "Unnamed creator"}
              </h1>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{c.email}</p>
              {(c.city || c.country) ? (
                <p className="mt-1 flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-5.1-7-11a7 7 0 1 1 14 0c0 5.9-7 11-7 11Z" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="2"/></svg>
                  {[c.city, c.country].filter(Boolean).join(", ")}
                </p>
              ) : null}
            </div>
          </div>
          <span
            className="shrink-0 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-medium"
            style={{
              color: c.completed ? "var(--color-on-brand)" : "var(--color-text-secondary)",
              background: c.completed ? "var(--color-brand)" : "var(--color-surface-2)",
            }}
          >
            {c.completed ? "Complete" : "Incomplete"}
          </span>
        </div>
        {c.socials.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {c.socials.map((s, i) => (
              <a key={i} href={s.profile_url ?? "#"} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full bg-[var(--color-surface-2)] px-3 py-1.5 text-sm capitalize text-[var(--color-text)] transition hover:bg-[var(--color-brand)]/15 hover:text-[var(--color-brand)]">
                {s.platform} <span className="text-xs text-[var(--color-text-muted)]">@{s.handle} · <span className="tabular">{s.follower_count.toLocaleString()}</span></span>
              </a>
            ))}
          </div>
        ) : null}
      </header>

      {/* recent videos — the creator's actual content, stats from the Apify worker */}
      {c.recent_videos.length ? (
        <section className={cardCls}>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Recent videos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {c.recent_videos.map((v, i) => (
              <a key={i} href={v.post_url} target="_blank" rel="noopener noreferrer" className="relative block aspect-[9/14] overflow-hidden rounded-xl bg-[var(--color-surface-2)] transition hover:ring-1 hover:ring-[var(--color-brand)]/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {v.thumbnail_url ? <img src={v.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] capitalize text-white">{v.platform}</span>
                <span className="tabular absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">▶ {v.views.toLocaleString()}</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {c.bio ? (
        <section className={cardCls}>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Bio</h2>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{c.bio}</p>
        </section>
      ) : null}

      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Demographics</h2>
        <dl>
          <Row label="Date of birth" value={c.date_of_birth} />
          <Row label="Gender" value={c.gender ? c.gender.replace(/_/g, " ") : null} />
          <Row label="Ethnicity" value={c.ethnicity} />
          <Row label="Primary language" value={c.primary_language} />
          <Row label="Languages" value={c.languages.length ? c.languages.join(", ") : null} />
          <Row label="Country" value={c.country} />
          <Row label="City" value={c.city} />
        </dl>
      </section>

      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Portfolio</h2>
        {c.portfolio.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No portfolio items.</p>
        ) : (
          <ul className="space-y-2">
            {c.portfolio.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-[var(--radius-btn)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)]">
                <span>
                  {p.brand_name ?? "Untitled"}
                  {p.platform ? ` · ${p.platform}` : ""}
                  {p.caption ? ` · ${p.caption}` : ""}
                </span>
                {p.video_url ? (
                  <a href={p.video_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm text-[var(--color-brand)] hover:underline">Watch ↗</a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      </main>
    </div>
  );
}
