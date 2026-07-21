"use client";

import { retryNonAuth } from "@/lib/api";
import { useState } from "react";
import { VideoThumb } from "@/components/ui/VideoThumb";
import { VideoModal } from "@/components/ui/VideoModal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addCampaignExample, deleteCampaignExample, listCampaignExamples } from "@/lib/admin";
import { PlatformIcon } from "@/components/ui/PlatformIcon";

// Admin management of a campaign's example videos: paste a social link (its
// thumbnail is fetched + cached), and delete any example — whether the admin
// added it or the app auto-picked it from top-performing submissions.
export function CampaignExamplesSection({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState<{ url: string; platform?: string | null; thumbnail_url?: string | null } | null>(null);

  const q = useQuery({
    queryKey: ["campaign-examples", campaignId],
    queryFn: () => listCampaignExamples(campaignId),
    retry: retryNonAuth,
  });
  const items = q.data ?? [];

  const addM = useMutation({
    mutationFn: (u: string) => addCampaignExample(campaignId, u),
    onSuccess: () => { setUrl(""); setError(""); qc.invalidateQueries({ queryKey: ["campaign-examples", campaignId] }); },
    onError: (e) => setError((e as Error).message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => deleteCampaignExample(campaignId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaign-examples", campaignId] }),
  });

  return (
    <section className="card-grad rounded-[var(--radius-card)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text)]">Example videos</h3>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
            Shown to creators on the campaign&apos;s overview. If you add none, the top-performing submissions appear automatically.
          </p>
        </div>
      </div>

      {/* add by link */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) addM.mutate(url.trim()); }}
          placeholder="Paste a TikTok / Instagram / YouTube / X video link…"
          className="min-h-10 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
        />
        <button
          type="button"
          disabled={!url.trim() || addM.isPending}
          onClick={() => addM.mutate(url.trim())}
          className="min-h-10 shrink-0 cursor-pointer rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:opacity-40"
        >
          {addM.isPending ? "Adding…" : "Add example"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p> : null}

      {/* current examples */}
      <div className="mt-4">
        {q.isLoading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No examples yet — add a link, or they&apos;ll auto-fill from top submissions.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {items.map((e) => (
              <div key={e.id} className="group relative aspect-[9/16] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]">
                {/* Rhys 2026-07-21: examples were look-but-don't-touch; an
                    admin needs to watch what creators are being shown. */}
                <VideoThumb
                  videoUrl={e.url}
                  thumbnailUrl={e.thumbnail_url}
                  platform={e.platform}
                  className="absolute inset-0 h-full w-full"
                  onPlay={() => setPlaying({ url: e.url, platform: e.platform, thumbnail_url: e.thumbnail_url })}
                />
                {e.source === "auto" ? (
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white">Auto</span>
                ) : null}
                <button
                  onClick={() => delM.mutate(e.id)}
                  disabled={delM.isPending}
                  aria-label="Remove example"
                  className="absolute right-1 top-1 grid h-6 w-6 cursor-pointer place-items-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100 hover:bg-[var(--color-danger)]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {playing ? (
        <VideoModal
          url={playing.url}
          platform={playing.platform}
          thumbnailUrl={playing.thumbnail_url}
          onClose={() => setPlaying(null)}
        />
      ) : null}
    </section>
  );
}
