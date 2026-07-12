"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth";
import { getMyPortfolio, isAuthError, type CreatorRichDetail } from "@/lib/api";
import { fmtInt, fmtMoney } from "@/lib/format";
import { ThumbImage } from "@/components/ui/ThumbImage";
import { RankBadge } from "@/components/gamification/RankBadge";

/* ---- helpers ---- */
// Normalize a possibly-bare URL ("nike.com") to an absolute one; null if invalid.
function normUrl(url: string): string | null {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).toString();
  } catch {
    return null;
  }
}
function hostOf(url: string): string | null {
  const n = normUrl(url);
  return n ? new URL(n).hostname.replace(/^www\./, "") : null;
}
// Company logo/look pulled from the work-experience URL — favicon service, no key.
const logoFor = (url: string) => {
  const h = hostOf(url);
  return h ? `https://www.google.com/s2/favicons?domain=${h}&sz=128` : null;
};

const IG = "https://www.instagram.com/";
const TT = "https://www.tiktok.com/";

function Avatar({ url, name }: { url: string | null; name: string }) {
  const initials = (name || "?").trim().slice(0, 1).toUpperCase();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="h-24 w-24 rounded-full object-cover ring-2 ring-[var(--color-brand)]/40" />;
  }
  return (
    <div className="grid h-24 w-24 place-items-center rounded-full bg-[var(--color-surface-2)] text-3xl font-semibold text-[var(--color-text-muted)] ring-2 ring-[var(--color-brand)]/40">
      {initials}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card-lumina rounded-[var(--radius-card)] p-4">
      <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-brand)]/15 text-[var(--color-brand)]">{icon}</div>
      <p className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">{value}</p>
      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}

const PLATFORM_GRADIENT: Record<string, string> = {
  tiktok: "linear-gradient(135deg,#25F4EE33,#FE2C5533)",
  instagram: "linear-gradient(135deg,#f0943344,#bc188844)",
  youtube: "linear-gradient(135deg,#ff000044,#28282844)",
};

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--color-text)]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function PortfolioPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setToken(getAuthToken());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  const q = useQuery({
    queryKey: ["my-portfolio"],
    queryFn: () => getMyPortfolio(token ?? ""),
    enabled: ready && !!token,
    retry: false,
  });
  useEffect(() => {
    if (q.isError && isAuthError(q.error)) router.replace("/login");
  }, [q.isError, q.error, router]);

  if (!ready || !token || q.isLoading) {
    return <p className="p-8 text-sm text-[var(--color-text-secondary)]">Loading…</p>;
  }
  const c = q.data as CreatorRichDetail | undefined;
  if (!c) return <p className="p-8 text-sm text-[var(--color-danger)]">Could not load your portfolio.</p>;

  const tagline = [c.creator_type === "ugc" ? "UGC Creator" : c.creator_type === "influencer" ? "Influencer" : c.creator_type ? "Creator" : null, c.niches[0]]
    .filter(Boolean)
    .join(" · ");
  const ig = c.socials.find((s) => s.platform === "instagram");
  const tt = c.socials.find((s) => s.platform === "tiktok");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <Avatar url={c.avatar_url} name={c.display_name ?? c.email} />
        <div className="mt-4 flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">{c.display_name ?? "Your name"}</h1>
          <RankBadge rank={c.rank} />
        </div>
        {tagline ? <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{tagline}</p> : null}
        <button
          onClick={copyLink}
          className="mt-4 inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-[var(--color-border)] px-4 text-sm text-[var(--color-text-secondary)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-text)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {copied ? "Copied" : "Copy Link"}
        </button>
      </div>

      {/* Performance */}
      <h2 className="mb-4 mt-10 text-lg font-semibold text-[var(--color-text)]">Performance</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Earned" value={fmtMoney(c.total_earned)} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
        <StatCard label="Views" value={fmtInt(c.total_views)} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" /></svg>} />
        <StatCard label="Engagement" value={`${c.engagement_rate}%`} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
        <StatCard label="Likes" value={fmtInt(c.total_likes)} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7 10v11M2 13v6a2 2 0 002 2h13a2 2 0 002-1.7l1.2-7A2 2 0 0019.2 10H14l1-4a2 2 0 00-2-2.5L7 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>} />
      </div>

      {/* Top Content */}
      <div className="mt-8">
        <SectionCard title="Top Content">
          {c.portfolio.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] py-10 text-center text-sm text-[var(--color-text-muted)]">
              No top videos yet. Add your best clips from your Profile.
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {c.portfolio.map((p) => {
                const Tag = p.video_url ? "a" : "div";
                return (
                  <Tag
                    key={p.id}
                    {...(p.video_url ? { href: p.video_url, target: "_blank", rel: "noopener noreferrer", "aria-label": p.brand_name ?? "Video" } : {})}
                    className="group relative block aspect-[9/16] w-28 shrink-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] sm:w-32"
                  >
                    <ThumbImage
                      src={p.thumbnail_url}
                      className="h-full w-full object-cover"
                      fallback={<div className="h-full w-full" style={{ background: PLATFORM_GRADIENT[p.platform ?? ""] ?? "linear-gradient(135deg,#22c55e33,#05261533)" }} />}
                    />
                    {/* view/like counts for top videos */}
                    {p.views > 0 || p.likes > 0 ? (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                        <div className="flex items-center gap-2 text-[10px] font-medium text-white">
                          <span className="tabular flex items-center gap-0.5">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" /></svg>
                            {fmtInt(p.views)}
                          </span>
                          <span className="tabular flex items-center gap-0.5">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                            {fmtInt(p.likes)}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </Tag>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Brands I've Worked With */}
      <div className="mt-4">
        <SectionCard title="Brands I've Worked With">
          {c.experiences.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Add work experience in your Profile to showcase brands here.</p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {c.experiences.map((e) => {
                const href = e.url ? normUrl(e.url) : null;
                const logo = e.url ? logoFor(e.url) : null;
                const inner = (
                  <>
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt="" className="h-6 w-6 rounded" />
                    ) : (
                      <span className="grid h-6 w-6 place-items-center rounded bg-[var(--color-brand)]/15 text-xs font-semibold text-[var(--color-brand)]">
                        {(e.org ?? e.title).slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="text-sm text-[var(--color-text)]">{e.org ?? e.title}</span>
                  </>
                );
                return (
                  <li key={e.id}>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 transition hover:border-[var(--color-brand)]">
                        {inner}
                      </a>
                    ) : (
                      <span className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5">{inner}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Let's Connect */}
      <div className="mt-4">
        <SectionCard title="Let's Connect">
          <div className="flex items-center gap-3">
            <ConnectIcon label="Instagram" href={ig?.profile_url || (ig ? `${IG}${ig.handle}` : null)} enabled={!!ig}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" /><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" /></svg>
            </ConnectIcon>
            <ConnectIcon label="TikTok" href={tt?.profile_url || (tt ? `${TT}@${tt.handle}` : null)} enabled={!!tt}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M14 3v11.5a3.5 3.5 0 11-3-3.46M14 6.5A5.5 5.5 0 0019 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </ConnectIcon>
            {!ig && !tt ? <span className="text-sm text-[var(--color-text-muted)]">Connect your socials in your Profile.</span> : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function ConnectIcon({ label, href, enabled, children }: { label: string; href: string | null; enabled: boolean; children: React.ReactNode }) {
  if (!enabled || !href) {
    return (
      <span aria-label={`${label} not connected`} className="grid h-11 w-11 place-items-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] opacity-40">
        {children}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid h-11 w-11 place-items-center rounded-full border border-[var(--color-border)] text-[var(--color-text)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]">
      {children}
    </a>
  );
}
