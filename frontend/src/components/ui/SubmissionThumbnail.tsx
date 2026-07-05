"use client";

import { useMemo, useState } from "react";

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

// Tiny deterministic hash so different blank cards borrow different siblings
// (instead of all falling on the same pool image).
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Guarantees every submission card shows an image. Mirrors the clippers app:
// own thumbnail -> computed YouTube cover -> a borrowed thumbnail from a sibling
// in the same campaign (the `pool`) -> the brand gradient as the last resort.
// Cycles to the next candidate whenever an image fails to load (e.g. an expired
// Instagram CDN signature).
export function SubmissionThumbnail({
  thumbnailUrl,
  postUrl,
  platform,
  pool = [],
  className = "",
  children,
}: {
  thumbnailUrl?: string | null;
  postUrl: string;
  platform: string;
  pool?: string[];
  className?: string;
  children?: React.ReactNode;
}) {
  const candidates = useMemo(() => {
    const list: string[] = [];
    if (thumbnailUrl) list.push(thumbnailUrl);
    if (platform === "youtube") {
      const id = youtubeId(postUrl);
      if (id) list.push(`https://img.youtube.com/vi/${id}/hqdefault.jpg`);
    }
    // borrow from siblings, rotated so cards don't all pick the same one
    const borrowable = pool.filter((u) => u && u !== thumbnailUrl);
    if (borrowable.length) {
      const start = hash(postUrl) % borrowable.length;
      for (let i = 0; i < borrowable.length; i++) {
        const u = borrowable[(start + i) % borrowable.length];
        if (!list.includes(u)) list.push(u);
      }
    }
    return list;
  }, [thumbnailUrl, postUrl, platform, pool]);

  const [idx, setIdx] = useState(0);
  const src = candidates[idx];

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-[var(--color-brand)]/25 to-[var(--color-bg-deep)] ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setIdx((n) => n + 1)}
        />
      ) : null}
      {children}
    </div>
  );
}
