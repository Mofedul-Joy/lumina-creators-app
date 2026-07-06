"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Avatar } from "@/components/admin/Avatar";
import { Pager } from "@/components/admin/Pager";
import { getAdminToken } from "@/lib/auth";
import { GENDERS, PLATFORMS, isAuthError, listCreators, type CreatorFilters, type Gender, type Platform } from "@/lib/api";

const PAGE_SIZE = 12;
const control =
  "min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]";

type Prefs = { gender: string; platform: string; ethnicity: string; primary_language: string; country: string; city: string; min_followers: string; completed_only: boolean };
const EMPTY: Prefs = { gender: "", platform: "", ethnicity: "", primary_language: "", country: "", city: "", min_followers: "", completed_only: false };

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function LineIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>; }
function GridIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /><rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" /></svg>; }

export default function AdminCreatorsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { setToken(getAdminToken()); setReady(true); }, []);
  useEffect(() => { if (ready && !token) router.replace("/admin/login"); }, [ready, token, router]);

  const [search, setSearch] = useState("");
  const [social, setSocial] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(EMPTY);
  const [showPrefs, setShowPrefs] = useState(false);
  const [view, setView] = useState<"grid" | "line">("line");
  const [page, setPage] = useState(1);
  const [focused, setFocused] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const dSearch = useDebounced(search);
  const dSocial = useDebounced(social);
  const dPrefs = useDebounced(prefs);

  const filters: CreatorFilters = useMemo(() => {
    const f: CreatorFilters = { limit: 500 };
    if (dSearch.trim()) f.q = dSearch.trim();
    if (dSocial.trim()) f.social = dSocial.trim();
    if (dPrefs.gender) f.gender = dPrefs.gender as Gender;
    if (dPrefs.platform) f.platform = dPrefs.platform as Platform;
    if (dPrefs.ethnicity.trim()) f.ethnicity = dPrefs.ethnicity.trim();
    if (dPrefs.primary_language.trim()) f.primary_language = dPrefs.primary_language.trim();
    if (dPrefs.country.trim()) f.country = dPrefs.country.trim();
    if (dPrefs.city.trim()) f.city = dPrefs.city.trim();
    if (dPrefs.min_followers.trim()) f.min_followers = Number(dPrefs.min_followers);
    if (dPrefs.completed_only) f.completed_only = true;
    return f;
  }, [dSearch, dSocial, dPrefs]);

  useEffect(() => setPage(1), [filters]);

  const q = useQuery({
    queryKey: ["admin-creators", filters],
    queryFn: () => listCreators(token ?? "", filters),
    enabled: ready && !!token,
    retry: false,
  });
  useEffect(() => { if (q.isError && isAuthError(q.error)) router.replace("/admin/login"); }, [q.isError, q.error, router]);

  const activePrefs = Object.entries(dPrefs).filter(([, v]) => v && v !== "").length;
  const rows = q.data ?? [];
  const pageCount = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  // Suggestions: prioritise names that START WITH the query (e.g. "N" → "Nate"),
  // then fall back to other matches the backend returned.
  const suggestions = (() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    const starts = rows.filter((c) => (c.display_name ?? "").toLowerCase().startsWith(term));
    const rest = rows.filter((c) => !starts.includes(c));
    return [...starts, ...rest].slice(0, 6);
  })();

  if (!ready || !token)
    return <main className="flex min-h-[100dvh] items-center justify-center"><p className="text-sm text-[var(--color-text-secondary)]">Loading…</p></main>;

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Creator database</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">Search the full roster by name, email, or social link.</p>
        <AdminTabs />

        {/* search row */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div ref={boxRef} className="relative min-w-[260px] flex-1">
            <input
              className={`${control} pr-10`}
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </span>
            {focused && suggestions.length > 0 ? (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
                {suggestions.map((c) => (
                  <Link key={c.id} href={`/admin/creators/${c.id}`} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-[var(--color-surface-2)]">
                    <span className="text-[var(--color-text)]">{c.display_name ?? "Unnamed"}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{c.email}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <button
            onClick={() => setShowPrefs((s) => !s)}
            className={`min-h-10 cursor-pointer rounded-xl px-4 text-sm transition ${showPrefs || activePrefs ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
          >
            Preferences{activePrefs ? ` · ${activePrefs}` : ""}
          </button>

          <div className="flex items-center rounded-full bg-[var(--color-surface)] p-1">
            {(["grid", "line"] as const).map((m) => (
              <button key={m} onClick={() => setView(m)} aria-label={`${m} view`}
                className={`grid h-8 w-8 cursor-pointer place-items-center rounded-full transition ${view === m ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}>
                {m === "grid" ? <GridIcon /> : <LineIcon />}
              </button>
            ))}
          </div>
        </div>

        {/* preferences panel */}
        {showPrefs ? (
          <div className="card-lumina mt-3 grid grid-cols-2 gap-3 rounded-[var(--radius-card)] p-5 sm:grid-cols-3 lg:grid-cols-4">
            <label className="block"><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Gender</span>
              <select className={control} value={prefs.gender} onChange={(e) => setPrefs({ ...prefs, gender: e.target.value })}>
                <option value="">Any</option>{GENDERS.map((g) => <option key={g} value={g}>{g.replace(/_/g, " ")}</option>)}
              </select></label>
            <label className="block"><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Platform</span>
              <select className={control} value={prefs.platform} onChange={(e) => setPrefs({ ...prefs, platform: e.target.value })}>
                <option value="">Any</option>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select></label>
            <label className="block"><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Ethnicity</span>
              <input className={control} value={prefs.ethnicity} onChange={(e) => setPrefs({ ...prefs, ethnicity: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Language</span>
              <input className={control} value={prefs.primary_language} onChange={(e) => setPrefs({ ...prefs, primary_language: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Country</span>
              <input className={control} value={prefs.country} onChange={(e) => setPrefs({ ...prefs, country: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">City</span>
              <input className={control} value={prefs.city} onChange={(e) => setPrefs({ ...prefs, city: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Min followers</span>
              <input className={control} type="number" value={prefs.min_followers} onChange={(e) => setPrefs({ ...prefs, min_followers: e.target.value })} /></label>
            <label className="block"><span className="mb-1 block text-xs text-[var(--color-text-secondary)]">Social link</span>
              <input className={control} placeholder="tiktok.com/@…" value={social} onChange={(e) => setSocial(e.target.value)} /></label>
            <label className="col-span-2 flex items-center gap-2 text-sm text-[var(--color-text)] sm:col-span-3 lg:col-span-4">
              <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={prefs.completed_only} onChange={(e) => setPrefs({ ...prefs, completed_only: e.target.checked })} />
              Completed profiles only
              {(activePrefs || social) ? <button onClick={() => { setPrefs(EMPTY); setSocial(""); }} className="ml-auto cursor-pointer text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Clear filters</button> : null}
            </label>
          </div>
        ) : null}

        {/* results */}
        <div className="mt-6">
          {q.isLoading ? (
            <p className="text-sm text-[var(--color-text-secondary)]">Loading creators…</p>
          ) : rows.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-text-muted)]">No creators match your search.</div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pageRows.map((c) => (
                <Link key={c.id} href={`/admin/creators/${c.id}`} className="card-grad rounded-[var(--radius-card)] p-4 transition hover:ring-1 hover:ring-[var(--color-brand)]/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar url={c.avatar_url} name={c.display_name} size={40} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--color-text)]">{c.display_name ?? "Unnamed creator"}</p>
                        <p className="truncate text-sm text-[var(--color-text-secondary)]">{c.email}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.completed ? "bg-emerald-500/15 text-emerald-400" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]"}`}>{c.completed ? "Complete" : "Incomplete"}</span>
                      {c.is_suspicious ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">Flagged</span> : null}
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    <dt className="text-[var(--color-text-muted)]">Country</dt><dd className="text-right text-[var(--color-text)]">{c.country ?? "-"}</dd>
                    <dt className="text-[var(--color-text-muted)]">Language</dt><dd className="text-right text-[var(--color-text)]">{c.primary_language ?? "-"}</dd>
                    <dt className="text-[var(--color-text-muted)]">Followers</dt><dd className="tabular text-right text-[var(--color-text)]">{c.total_followers.toLocaleString()}</dd>
                  </dl>
                  {c.platforms.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">{c.platforms.map((p) => <span key={p} className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">{p}</span>)}</div>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-[var(--color-surface)] text-xs uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                  <tr><th className="px-4 py-3 font-medium">Creator</th><th className="px-4 py-3 font-medium">Country</th><th className="px-4 py-3 font-medium">Language</th><th className="px-4 py-3 text-right font-medium">Followers</th><th className="px-4 py-3 font-medium">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {pageRows.map((c) => (
                    <tr key={c.id} onClick={() => router.push(`/admin/creators/${c.id}`)} className="cursor-pointer transition hover:bg-[var(--color-surface)]/50">
                      <td className="px-4 py-3"><p className="font-medium text-[var(--color-text)]">{c.display_name ?? "Unnamed"}</p><p className="text-xs text-[var(--color-text-muted)]">{c.email}</p></td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{c.country ?? "-"}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{c.primary_language ?? "-"}</td>
                      <td className="tabular px-4 py-3 text-right text-[var(--color-text)]">{c.total_followers.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        {c.completed ? <span className="text-xs text-emerald-400">Complete</span> : <span className="text-xs text-[var(--color-text-muted)]">Incomplete</span>}
                        {c.is_suspicious ? <span className="ml-2 text-xs text-amber-400">Flagged</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={page} pageCount={pageCount} onPage={setPage} total={rows.length} />
        </div>
      </main>
    </div>
  );
}
