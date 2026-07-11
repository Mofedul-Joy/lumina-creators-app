"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import {
  addTopVideo,
  deleteTopVideo,
  listTopVideos,
  refreshTopVideo,
  type TopVideoOut,
  type TopVideoPlatform,
} from "@/lib/api";
import { fmtInt } from "@/lib/format";
import { PlatformIcon } from "@/components/ui/PlatformIcon";
import { Skeleton } from "@/components/ui/Skeleton";

const MAX = 3;
const PLATFORMS: TopVideoPlatform[] = ["tiktok", "instagram"];

function VideoCard({ v, onDelete }: { v: TopVideoOut; onDelete: (id: string) => void }) {
  return (
    <div className="group relative aspect-[9/16] w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]">
      {v.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <a href={v.video_url ?? "#"} target="_blank" rel="noopener noreferrer">
          <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />
        </a>
      ) : (
        <div className="grid h-full w-full place-items-center text-[var(--color-text-muted)]">
          {v.platform ? <PlatformIcon name={v.platform} className="h-6 w-6" /> : null}
        </div>
      )}

      {/* stats overlay */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <div className="flex items-center gap-3 text-[11px] font-medium text-white">
          <span className="tabular flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" /></svg>
            {fmtInt(v.views)}
          </span>
          <span className="tabular flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
            {fmtInt(v.likes)}
          </span>
        </div>
      </div>

      <button
        onClick={() => onDelete(v.id)}
        aria-label="Remove video"
        className="absolute right-1.5 top-1.5 grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

export function TopVideosTab() {
  const qc = useQueryClient();
  const token = getAuthToken() ?? "";
  const [platform, setPlatform] = useState<TopVideoPlatform>("tiktok");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["top-videos"], queryFn: () => listTopVideos(token), enabled: !!token, retry: false });
  const videos = q.data ?? [];
  const atMax = videos.length >= MAX;

  async function add() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await addTopVideo(token, platform, url.trim());
      setUrl("");
      qc.invalidateQueries({ queryKey: ["top-videos"] });
      qc.invalidateQueries({ queryKey: ["my-portfolio"] });
      // Stats fill in async — the add stays snappy, this updates the card when done.
      refreshTopVideo(token, created.id)
        .then(() => {
          qc.invalidateQueries({ queryKey: ["top-videos"] });
          qc.invalidateQueries({ queryKey: ["my-portfolio"] });
        })
        .catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that video.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await deleteTopVideo(token, id);
    qc.invalidateQueries({ queryKey: ["top-videos"] });
    qc.invalidateQueries({ queryKey: ["my-portfolio"] });
  }

  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold text-[var(--color-text)]">Top videos</h2>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Add up to {MAX} of your best TikTok or Instagram videos. They show as Top Content on your portfolio.
      </p>

      {/* add row */}
      {!atMax ? (
        <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-[var(--color-surface)] p-1">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  aria-pressed={platform === p}
                  className={`grid h-8 w-8 cursor-pointer place-items-center rounded-full transition ${
                    platform === p ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                  title={p}
                >
                  <PlatformIcon name={p} className="h-4 w-4" />
                </button>
              ))}
            </div>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder={platform === "tiktok" ? "Paste a TikTok video link…" : "Paste an Instagram reel link…"}
              className="min-h-10 min-w-0 flex-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
            />
            <button
              onClick={add}
              disabled={!url.trim() || busy}
              aria-label="Add video"
              className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-[var(--color-brand)] text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="animate-spin"><path d="M12 3a9 9 0 100 18 9 9 0 000-18" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" /><path d="M12 3a9 9 0 019 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
              )}
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p> : null}
        </div>
      ) : null}

      {/* grid */}
      <div className="mt-4">
        {q.isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="aspect-[9/16] w-full rounded-xl" />)}
          </div>
        ) : videos.length === 0 ? (
          <div className="card-lumina rounded-[var(--radius-card)] p-10 text-center text-sm text-[var(--color-text-secondary)]">
            No top videos yet. Paste a link above to add your best work.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {videos.map((v) => <VideoCard key={v.id} v={v} onDelete={remove} />)}
          </div>
        )}
      </div>
    </section>
  );
}
