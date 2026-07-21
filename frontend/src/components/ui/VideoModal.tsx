"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getEmbedUrl, isDirectVideoUrl, isPortraitEmbed } from "@/lib/embeds";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";

/**
 * Plays a showcase video INLINE on Lumina (campaign examples, portfolio, top
 * videos) instead of bouncing to a dead "Explore more on <platform>" tab.
 *
 * Three cases, in order:
 *  1. The creator uploaded the file to us — play it with a native <video>.
 *     There is no post to embed and no platform to link out to.
 *  2. A linked social post — embed the real post via the platform's public
 *     iframe (getEmbedUrl).
 *  3. No embeddable surface (Facebook) or an unparseable id — show the
 *     thumbnail + a clear "Open on <platform>" link so it's never a dead end.
 */
export function VideoModal({
  url, platform, thumbnailUrl, isUpload, onClose,
}: {
  url: string;
  platform?: string | null;
  thumbnailUrl?: string | null;
  /** Set when the caller knows this is a creator upload. The URL heuristic
   *  covers most cases, but an object key built from a filename with no
   *  extension has none to sniff, so prefer this when the API tells you. */
  isUpload?: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!mounted) return null;

  const plat = platform || "";
  const direct = isUpload || isDirectVideoUrl(url);
  const embedUrl = direct ? null : getEmbedUrl(plat, url);
  // Uploads are shot on phones far more often than not, so default them to the
  // portrait frame; the video itself is object-contain so a landscape upload
  // still shows whole, just letterboxed.
  const portrait = direct ? true : isPortraitEmbed(plat, url);

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Video player"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-black shadow-2xl ${
          portrait ? "aspect-[9/16] w-full max-w-[380px]" : "aspect-video w-full max-w-3xl"
        }`}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2 top-2 z-20 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>

        {direct ? (
          <video
            src={url}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full bg-black object-contain"
          />
        ) : embedUrl ? (
          <iframe
            src={embedUrl}
            title="Video"
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          // No embeddable surface (e.g. Facebook) — show the thumbnail + a clear
          // link out so it's never a silent dead-end.
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
            ) : null}
            <span className="relative z-10 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
              {plat ? <PlatformIcon name={plat} className="h-7 w-7" /> : null}
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 inline-flex min-h-11 items-center rounded-full bg-[var(--color-brand)] px-6 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
            >
              Open on {plat ? platformLabel(plat) : "source"} ↗
            </a>
          </div>
        )}
      </div>

      {/* open-original link, for linked social posts only — an upload has no
          external original to open. */}
      {direct ? null : (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="mt-3 inline-flex items-center gap-1.5 text-sm text-white/80 transition hover:text-white"
      >
        {plat ? <PlatformIcon name={plat} className="h-4 w-4" /> : null}
        Open original {plat ? `on ${platformLabel(plat)}` : ""} ↗
      </a>
      )}
    </div>,
    document.body,
  );
}

export default VideoModal;
