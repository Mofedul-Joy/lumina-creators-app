"use client";

import { useEffect, useRef, useState } from "react";
import { isDirectVideoUrl, derivedPosterUrl } from "@/lib/embeds";
import { PlatformIcon } from "@/components/ui/PlatformIcon";

/**
 * One clickable video tile, used everywhere a creator's video is showcased
 * (portfolio, top content, admin creator profile, campaign examples, review
 * grids). Pair it with <VideoModal> so a click plays the video in place.
 *
 * The poster comes from, in order:
 *   1. `thumbnailUrl` — a scraped/re-hosted still for a linked social post.
 *   2. For a video the creator uploaded to us there IS no stored poster, so we
 *      mount the file itself with `preload="metadata"`; the browser decodes and
 *      paints frame one. That costs a few hundred KB per tile instead of a
 *      whole video, and it's why the tile is muted and has no controls. The
 *      element only mounts once the tile is near the viewport — a creator with
 *      100 clips would otherwise kick off 100 range requests on page load.
 *   3. A platform-tinted gradient, so a tile is never blank.
 */
const PLATFORM_GRADIENT: Record<string, string> = {
  tiktok: "linear-gradient(135deg,#25F4EE33,#FE2C5533)",
  instagram: "linear-gradient(135deg,#f0943355,#dc274355,#bc188855)",
  youtube: "linear-gradient(135deg,#ff000055,#28282855)",
  twitter: "linear-gradient(135deg,#1DA1F255,#0d8ecf55)",
  facebook: "linear-gradient(135deg,#1877F255,#0d5dbc55)",
};

export function VideoThumb({
  videoUrl,
  thumbnailUrl,
  platform,
  isUpload,
  label,
  badge,
  className = "",
  onPlay,
}: {
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  platform?: string | null;
  /** See VideoModal — an explicit signal beats sniffing the URL. */
  isUpload?: boolean;
  label?: string;
  badge?: React.ReactNode;
  className?: string;
  onPlay: () => void;
}) {
  // Poster candidates, tried in order until one loads. The stored thumbnail
  // comes first, but it can be a hotlinked platform CDN image or an EXPIRED
  // presigned R2 URL that now 403s — so a linked YouTube video falls through to
  // its free public still (i.ytimg) before giving up to a gradient. Instant
  // either way; no per-load video decode.
  const posters = [thumbnailUrl, derivedPosterUrl(platform, videoUrl)].filter(Boolean) as string[];
  const [posterIdx, setPosterIdx] = useState(0);
  const poster = posters[posterIdx];
  const showImg = !!poster;
  const ref = useRef<HTMLButtonElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  // A hotlinked platform CDN thumbnail can 403 long after it was stored, so an
  // upload still falls back to its own first frame if the image dies.
  const showFrame = !showImg && !!videoUrl && (isUpload || isDirectVideoUrl(videoUrl));

  return (
    <button
      ref={ref}
      type="button"
      onClick={onPlay}
      aria-label={label ? `Play ${label}` : "Play video"}
      className={`group relative block cursor-pointer overflow-hidden bg-[var(--color-surface-2)] ${className}`}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          onError={() => setPosterIdx((i) => i + 1)}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      ) : showFrame && near ? (
        <video
          src={videoUrl!}
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          className="pointer-events-none h-full w-full object-cover"
        />
      ) : (
        <span
          className="block h-full w-full"
          style={{ background: PLATFORM_GRADIENT[platform ?? ""] ?? "linear-gradient(135deg,#22c55e33,#05261533)" }}
        />
      )}

      {/* play affordance — the whole point of the tile is that it's watchable */}
      <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/20 transition group-hover:bg-black/35">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition group-hover:scale-110">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7L8 5Z" />
          </svg>
        </span>
      </span>

      {platform ? (
        <span className="pointer-events-none absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
          <PlatformIcon name={platform} className="h-4 w-4" />
        </span>
      ) : null}

      {badge}
    </button>
  );
}

export default VideoThumb;
