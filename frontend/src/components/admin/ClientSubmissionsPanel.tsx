"use client";

// Per-client submissions panel for the admin dashboard. Pick a brand from the
// dropdown to see that client's submissions across all their campaigns —
// filterable by platform (TikTok/Instagram/…) and by embed health
// (healthy / embed-broken / unavailable) — plus a "View as client" button that
// opens the brand's own dashboard in a short-lived impersonation session.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAdminClients, listAdminClientCampaigns, listSubmissions, impersonateClientById, type AdminClient } from "@/lib/admin";
import { clientRealmUrl } from "@/lib/realmUrls";
import { Select } from "@/components/ui/Select";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { SubmissionThumbnail } from "@/components/ui/SubmissionThumbnail";
import { fmtInt } from "@/lib/format";

const ALL_PLATFORMS = ["tiktok", "instagram", "youtube", "twitter", "facebook"] as const;
const HEALTH = [
  { key: "", label: "All" },
  { key: "healthy", label: "Healthy" },
  { key: "embed_broken", label: "Embed broken" },
  { key: "unavailable", label: "Unavailable" },
] as const;

type Health = "" | "healthy" | "embed_broken" | "unavailable";

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card-grad rounded-[var(--radius-card)] p-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
      <p className={`tabular mt-3 text-3xl font-semibold ${accent ? "text-[var(--color-brand-soft)]" : "text-[var(--color-text)]"}`}>{value}</p>
    </div>
  );
}

export function ClientSubmissionsPanel() {
  const [clientId, setClientId] = useState("");
  const [platform, setPlatform] = useState("");
  const [health, setHealth] = useState<Health>("");
  const [viewing, setViewing] = useState(false);

  const clientsQ = useQuery({ queryKey: ["admin-clients"], queryFn: listAdminClients });
  // Rhys 2026-07-21: alphabetical, like every other picker in the admin.
  const clients = useMemo(
    () => [...(clientsQ.data ?? [])].sort((a, b) =>
      (a.name?.trim() || a.email).localeCompare(b.name?.trim() || b.email, undefined, { sensitivity: "base" })),
    [clientsQ.data],
  );
  const selected: AdminClient | undefined = clients.find((c) => c.id === clientId);

  const campaignsQ = useQuery({
    queryKey: ["admin-client-campaigns", clientId],
    queryFn: () => listAdminClientCampaigns(clientId),
    enabled: !!clientId,
  });

  const subsQ = useQuery({
    queryKey: ["admin-client-subs", clientId, platform, health],
    queryFn: () => listSubmissions({ client_id: clientId, platform: platform || undefined, health: health || undefined, limit: 300 }),
    enabled: !!clientId,
  });
  const rows = subsQ.data ?? [];
  const thumbPool = useMemo(() => rows.map((s) => s.thumbnail_url).filter(Boolean) as string[], [rows]);

  async function viewAsClient() {
    if (!clientId || viewing) return;
    setViewing(true);
    try {
      const { access_token } = await impersonateClientById(clientId);
      window.open(clientRealmUrl(`/dashboard?impersonate_token=${encodeURIComponent(access_token)}`), "_blank", "noopener");
    } finally {
      setViewing(false);
    }
  }

  const clientLabel = (c: AdminClient) => c.name?.trim() || c.email;

  return (
    <section className="mt-12 border-t border-[var(--color-border)] pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Per-client view</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text)]">Client submissions</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Pick a brand to see its submissions, or open the brand&apos;s own dashboard.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-64"
            value={clientId}
            onChange={setClientId}
            options={[
              { value: "", label: clientsQ.isLoading ? "Loading clients…" : "Select a client" },
              ...clients.map((c) => ({ value: c.id, label: clientLabel(c) })),
            ]}
          />
          <button
            onClick={viewAsClient}
            disabled={!clientId || viewing}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[var(--color-brand)] px-4 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {viewing ? "Opening…" : "View as client"}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M8 7h9v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      {!clientId ? (
        <div className="card-lumina mt-6 rounded-[var(--radius-card)] p-10 text-center text-sm text-[var(--color-text-secondary)]">
          Select a client above to view their campaigns&apos; submissions.
        </div>
      ) : (
        <>
          {/* per-client totals */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <StatTile label="Submissions" value={fmtInt(selected?.submission_count ?? 0)} accent />
            <StatTile label="Total views" value={fmtInt(selected?.total_views ?? 0)} />
            <StatTile label="Interactions" value={fmtInt(selected?.total_interactions ?? 0)} />
          </div>

          {/* Rhys 2026-07-21: "every single campaign ever should appear here in
              alphabetical order … all from here plus the completed section."
              The submissions grid below is submission-driven, so a campaign with
              no posts yet never showed up — this roster is campaign-driven. */}
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
              Campaigns{campaignsQ.data ? ` (${campaignsQ.data.length})` : ""}
            </p>
            {campaignsQ.isLoading ? (
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">Loading campaigns…</p>
            ) : !campaignsQ.data?.length ? (
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">No campaigns assigned to this client yet.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {campaignsQ.data.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-text-secondary)]"
                  >
                    {c.name}
                    <span className="rounded-full bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] capitalize text-[var(--color-text-muted)]">
                      {c.status}
                    </span>
                    <span className="tabular text-[var(--color-text-muted)]">{c.submissions.length}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* filters: platform + health */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-full bg-[var(--color-surface)] p-1">
              <button
                onClick={() => setPlatform("")}
                className={`min-h-8 cursor-pointer rounded-full px-3 text-xs transition ${platform === "" ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
              >
                All
              </button>
              {ALL_PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(platform === p ? "" : p)}
                  aria-label={platformLabel(p)}
                  title={platformLabel(p)}
                  className={`grid h-8 w-8 cursor-pointer place-items-center rounded-full transition ${platform === p ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
                >
                  <PlatformIcon name={p} className="h-4 w-4" />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-full bg-[var(--color-surface)] p-1">
              {HEALTH.map((h) => (
                <button
                  key={h.key}
                  onClick={() => setHealth(h.key as Health)}
                  className={`min-h-8 cursor-pointer rounded-full px-3 text-xs transition ${health === h.key ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* submissions grid */}
          {subsQ.isLoading ? (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-video animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface-2)]" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="card-lumina mt-6 rounded-[var(--radius-card)] p-10 text-center text-sm text-[var(--color-text-secondary)]">
              No submissions match these filters.
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((s) => (
                <a
                  key={s.id}
                  href={s.post_url}
                  target="_blank"
                  rel="noreferrer"
                  className="card-lumina card-interactive flex flex-col overflow-hidden rounded-[var(--radius-card)]"
                >
                  <SubmissionThumbnail
                    thumbnailUrl={s.thumbnail_url}
                    postUrl={s.post_url}
                    platform={s.platform}
                    pool={thumbPool}
                    className="aspect-video w-full"
                  >
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5Z" /></svg>
                      </span>
                    </span>
                    <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/50 text-white">
                      <PlatformIcon name={s.platform} className="h-3.5 w-3.5" />
                    </span>
                    {s.post_unavailable ? (
                      <span className="absolute bottom-2 left-2 rounded-full bg-red-500/80 px-2 py-0.5 text-[10px] font-medium text-white">Unavailable</span>
                    ) : s.embed_broken ? (
                      <span className="absolute bottom-2 left-2 rounded-full bg-amber-500/80 px-2 py-0.5 text-[10px] font-medium text-white">Embed broken</span>
                    ) : null}
                  </SubmissionThumbnail>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-[var(--color-text-muted)]">
                    <span className="truncate">{s.campaign_name}</span>
                    <span className="truncate">{s.creator_name ?? ""}</span>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-[var(--color-border)] bg-[var(--color-surface-2)] text-center">
                    <div className="px-2 py-3">
                      <p className="tabular text-base font-semibold text-[var(--color-brand-soft)]">{fmtInt(s.views)}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Views</p>
                    </div>
                    <div className="px-2 py-3">
                      <p className="tabular text-base font-semibold text-[var(--color-text)]">{fmtInt(s.likes)}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Likes</p>
                    </div>
                    <div className="px-2 py-3">
                      <p className="tabular text-base font-semibold text-[var(--color-text)]">{fmtInt(s.comments)}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Comments</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default ClientSubmissionsPanel;
