"use client";

// <img> that renders a fallback node when the source fails to load (dead CDN
// links, expired TikTok/IG thumbnails, etc.) instead of a broken-image glyph.
import { useState, type ReactNode } from "react";

export function ImgFallback({
  src,
  alt = "",
  className,
  fallback = null,
}: {
  src: string;
  alt?: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}
