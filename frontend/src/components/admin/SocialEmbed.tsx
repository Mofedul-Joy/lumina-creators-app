"use client";

import { useEffect, useState } from "react";
import { getEmbedUrl, isPortraitEmbed } from "@/lib/embeds";
import { platformLabel } from "@/components/ui/PlatformIcon";
import { SubmissionThumbnail } from "@/components/ui/SubmissionThumbnail";

// Watch a submitted post INLINE on Lumina. YouTube/TikTok/Instagram/X embed via
// each platform's public iframe (no API key). Facebook — or any post whose embed
// the backend flagged broken (embed_broken, e.g. IG geo-restricted) — falls back
// to a thumbnail that opens the original post in a new tab. A persistent
// "Open on <platform>" link is always shown so the admin is never stuck.

// While the platform iframe boots (and buffers), every embed paints solid black —
// which reads as "broken", not "loading". We cover it with our own loading state
// (the cached thumbnail, blurred, behind a spinner) until the iframe fires onLoad,
// so the admin always sees the video is on its way instead of a dead black box.
function LoadingCover({ platform, thumbnailUrl }: { platform: string; thumbnailUrl?: string | null }) {
  return (
    <div className="absolute inset-0 z-10 overflow-hidden">
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnailUrl} alt="" className="h-full w-full scale-110 object-cover opacity-40 blur-md" />
      ) : null}
      <div className="absolute inset-0 grid place-items-center gap-3 bg-black/40">
        <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-white/90" />
        <span className="text-xs font-medium text-white/80">Loading {platformLabel(platform)} video…</span>
      </div>
    </div>
  );
}

export function SocialEmbed({
  platform,
  postUrl,
  thumbnailUrl,
  embedBroken,
  pool,
}: {
  platform: string;
  postUrl: string;
  thumbnailUrl?: string | null;
  embedBroken?: boolean;
  pool?: string[];
}) {
  const embedUrl = getEmbedUrl(platform, postUrl);
  const portrait = isPortraitEmbed(platform, postUrl);
  // Let the admin force the fallback if an embed loads blank/login-walled.
  const [forceFallback, setForceFallback] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // New submission opened in the same modal → show the loader again.
  useEffect(() => { setLoaded(false); setForceFallback(false); }, [embedUrl]);
  const canEmbed = !!embedUrl && !embedBroken && !forceFallback;

  const openLink = (
    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
      <a
        href={postUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-medium text-[var(--color-brand-soft)] hover:underline"
      >
        Open on {platformLabel(platform)}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M17 7H9m8 0v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </a>
      {canEmbed ? (
        <button
          onClick={() => setForceFallback(true)}
          className="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          Player blank? Show preview
        </button>
      ) : null}
    </div>
  );

  if (canEmbed) {
    return (
      <div>
        <div
          className={`relative mx-auto w-full overflow-hidden rounded-[var(--radius-btn)] bg-black ${
            portrait ? "max-w-[400px]" : ""
          }`}
          style={portrait ? { height: "min(72vh, 660px)" } : { aspectRatio: "16 / 9" }}
        >
          {!loaded ? <LoadingCover platform={platform} thumbnailUrl={thumbnailUrl} /> : null}
          <iframe
            src={embedUrl!}
            title={`${platformLabel(platform)} post`}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
            allowFullScreen
            loading="lazy"
            onLoad={() => setLoaded(true)}
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        {openLink}
      </div>
    );
  }

  // Fallback: thumbnail that opens the real post.
  return (
    <div>
      <a href={postUrl} target="_blank" rel="noopener noreferrer" className="block">
        <SubmissionThumbnail
          thumbnailUrl={thumbnailUrl}
          postUrl={postUrl}
          platform={platform}
          pool={pool}
          className="aspect-video w-full rounded-[var(--radius-btn)]"
        >
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5Z" /></svg>
            </span>
          </span>
          <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white">
            {platformLabel(platform)} · open post
          </span>
        </SubmissionThumbnail>
      </a>
      {openLink}
    </div>
  );
}
