"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { getAdminToken } from "@/lib/auth";
import { getCreatorDetail, isAuthError } from "@/lib/api";

const cardCls =
  "rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4";

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
    <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
      <Link href="/admin/creators" className="text-sm text-[var(--color-brand)] underline">
        ← Back to database
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-[var(--color-text)]">
            {c.display_name ?? "Unnamed creator"}
          </h1>
          <p className="mt-1 text-[var(--color-text-secondary)]">{c.email}</p>
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
      </header>

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
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Social accounts</h2>
        {c.socials.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No social accounts.</p>
        ) : (
          <ul className="space-y-2">
            {c.socials.map((s, i) => (
              <li
                key={`${s.platform}-${s.handle}-${i}`}
                className="flex items-center justify-between rounded-[var(--radius-btn)] border border-[var(--color-border)] px-3 py-2"
              >
                <span className="text-sm text-[var(--color-text)]">
                  {s.platform} · @{s.handle} ·{" "}
                  <span className="tabular">{s.follower_count.toLocaleString()}</span> followers
                </span>
                {s.profile_url ? (
                  <a
                    href={s.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--color-brand)] underline"
                  >
                    Visit
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Portfolio</h2>
        {c.portfolio.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No portfolio items.</p>
        ) : (
          <ul className="space-y-2">
            {c.portfolio.map((p) => (
              <li
                key={p.id}
                className="rounded-[var(--radius-btn)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)]"
              >
                {p.brand_name ?? "Untitled"}
                {p.platform ? ` · ${p.platform}` : ""}
                {p.caption ? ` · ${p.caption}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
