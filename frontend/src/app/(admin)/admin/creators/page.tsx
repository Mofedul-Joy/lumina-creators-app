"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { getAdminToken } from "@/lib/auth";
import {
  GENDERS,
  PLATFORMS,
  listCreators,
  type CreatorFilters,
  type Gender,
  type Platform,
} from "@/lib/api";

const PAGE_SIZE = 50;

const labelCls = "block text-xs font-medium text-[var(--color-text-secondary)]";
const controlCls =
  "min-h-10 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus-visible:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]";

type FilterForm = {
  q: string;
  gender: string;
  ethnicity: string;
  primary_language: string;
  country: string;
  city: string;
  age_min: string;
  age_max: string;
  platform: string;
  min_followers: string;
  completed_only: boolean;
};

const EMPTY_FILTERS: FilterForm = {
  q: "",
  gender: "",
  ethnicity: "",
  primary_language: "",
  country: "",
  city: "",
  age_min: "",
  age_max: "",
  platform: "",
  min_followers: "",
  completed_only: false,
};

function toFilters(f: FilterForm, offset: number): CreatorFilters {
  const out: CreatorFilters = { limit: PAGE_SIZE, offset };
  if (f.q.trim()) out.q = f.q.trim();
  if (f.gender) out.gender = f.gender as Gender;
  if (f.ethnicity.trim()) out.ethnicity = f.ethnicity.trim();
  if (f.primary_language.trim()) out.primary_language = f.primary_language.trim();
  if (f.country.trim()) out.country = f.country.trim();
  if (f.city.trim()) out.city = f.city.trim();
  if (f.age_min.trim()) out.age_min = Number(f.age_min);
  if (f.age_max.trim()) out.age_max = Number(f.age_max);
  if (f.platform) out.platform = f.platform as Platform;
  if (f.min_followers.trim()) out.min_followers = Number(f.min_followers);
  if (f.completed_only) out.completed_only = true;
  return out;
}

export default function AdminCreatorsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setToken(getAdminToken());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && !token) router.replace("/admin/login");
  }, [ready, token, router]);

  // Draft filters (form) vs applied filters (query).
  const [draft, setDraft] = useState<FilterForm>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterForm>(EMPTY_FILTERS);
  const [offset, setOffset] = useState(0);

  const creatorsQ = useQuery({
    queryKey: ["admin-creators", applied, offset],
    queryFn: () => listCreators(token ?? "", toFilters(applied, offset)),
    enabled: ready && !!token,
    retry: false,
  });

  useEffect(() => {
    if (creatorsQ.isError) router.replace("/admin/login");
  }, [creatorsQ.isError, router]);

  function applyFilters() {
    setOffset(0);
    setApplied(draft);
  }
  function resetFilters() {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setOffset(0);
  }

  const rows = creatorsQ.data ?? [];
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const canPrev = offset > 0;
  const canNext = rows.length === PAGE_SIZE;

  if (!ready || !token)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--color-bg)]">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--color-brand)]">Lumina Admin</p>
          <h1 className="text-3xl font-semibold text-[var(--color-text)]">Creator database</h1>
          <p className="mt-1 text-[var(--color-text-secondary)]">
            Filter and drill into the full creator roster.
          </p>
        </div>
      </header>

      {/* filters */}
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1 sm:col-span-2 lg:col-span-2">
            <label className={labelCls}>Search</label>
            <input
              className={controlCls}
              placeholder="Name or email"
              value={draft.q}
              onChange={(e) => setDraft({ ...draft, q: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters();
              }}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Gender</label>
            <select
              className={controlCls}
              value={draft.gender}
              onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
            >
              <option value="">Any</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Platform</label>
            <select
              className={controlCls}
              value={draft.platform}
              onChange={(e) => setDraft({ ...draft, platform: e.target.value })}
            >
              <option value="">Any</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Ethnicity</label>
            <input
              className={controlCls}
              value={draft.ethnicity}
              onChange={(e) => setDraft({ ...draft, ethnicity: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Language</label>
            <input
              className={controlCls}
              value={draft.primary_language}
              onChange={(e) => setDraft({ ...draft, primary_language: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Country</label>
            <input
              className={controlCls}
              value={draft.country}
              onChange={(e) => setDraft({ ...draft, country: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>City</label>
            <input
              className={controlCls}
              value={draft.city}
              onChange={(e) => setDraft({ ...draft, city: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Age min</label>
            <input
              className={controlCls}
              type="number"
              value={draft.age_min}
              onChange={(e) => setDraft({ ...draft, age_min: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Age max</label>
            <input
              className={controlCls}
              type="number"
              value={draft.age_max}
              onChange={(e) => setDraft({ ...draft, age_max: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Min followers</label>
            <input
              className={controlCls}
              type="number"
              value={draft.min_followers}
              onChange={(e) => setDraft({ ...draft, min_followers: e.target.value })}
            />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm text-[var(--color-text)]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-brand)]"
              checked={draft.completed_only}
              onChange={(e) => setDraft({ ...draft, completed_only: e.target.checked })}
            />
            Completed only
          </label>
        </div>
        <div className="flex gap-3">
          <div className="w-32">
            <Button type="button" onClick={applyFilters}>
              Apply
            </Button>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-11 cursor-pointer rounded-[var(--radius-btn)] border border-[var(--color-border)] px-4 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
          >
            Reset
          </button>
        </div>
      </section>

      {/* results */}
      {creatorsQ.isLoading ? (
        <p className="text-sm text-[var(--color-text-secondary)]">Loading creators…</p>
      ) : creatorsQ.isError ? (
        <p className="text-sm text-[var(--color-danger)]">
          {(creatorsQ.error as Error).message}
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-text-muted)]">
          No creators match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <Link
              key={c.id}
              href={`/admin/creators/${c.id}`}
              className="group rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-brand)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[var(--color-text)]">
                    {c.display_name ?? "Unnamed creator"}
                  </p>
                  <p className="truncate text-sm text-[var(--color-text-secondary)]">{c.email}</p>
                </div>
                <span
                  className="shrink-0 rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-medium"
                  style={{
                    color: c.completed ? "var(--color-on-brand)" : "var(--color-text-secondary)",
                    background: c.completed ? "var(--color-brand)" : "var(--color-surface-2)",
                  }}
                >
                  {c.completed ? "Complete" : "Incomplete"}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <dt className="text-[var(--color-text-muted)]">Country</dt>
                <dd className="text-right text-[var(--color-text)]">{c.country ?? "—"}</dd>
                <dt className="text-[var(--color-text-muted)]">Language</dt>
                <dd className="text-right text-[var(--color-text)]">{c.primary_language ?? "—"}</dd>
                <dt className="text-[var(--color-text-muted)]">Gender</dt>
                <dd className="text-right text-[var(--color-text)]">
                  {c.gender ? c.gender.replace(/_/g, " ") : "—"}
                </dd>
                <dt className="text-[var(--color-text-muted)]">Followers</dt>
                <dd className="text-right tabular text-[var(--color-text)]">
                  {c.total_followers.toLocaleString()}
                </dd>
              </dl>

              {c.platforms.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.platforms.map((p) => (
                    <span
                      key={p}
                      className="rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      )}

      {/* pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-muted)]">
          Page <span className="tabular">{page}</span> · showing{" "}
          <span className="tabular">{rows.length}</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            className="min-h-10 cursor-pointer rounded-[var(--radius-btn)] border border-[var(--color-border)] px-4 text-sm text-[var(--color-text)] transition hover:border-[var(--color-brand)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            className="min-h-10 cursor-pointer rounded-[var(--radius-btn)] border border-[var(--color-border)] px-4 text-sm text-[var(--color-text)] transition hover:border-[var(--color-brand)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}
