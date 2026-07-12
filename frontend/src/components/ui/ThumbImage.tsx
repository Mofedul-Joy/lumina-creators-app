"use client";

import { useState } from "react";

/**
 * A thumbnail <img> that degrades to a fallback when the source fails to load.
 * Platform CDN links can expire or hotlink-block; without this the browser shows
 * a broken-image icon. On error (or no src) we render `fallback` instead.
 */
export function ThumbImage({
  src,
  className,
  fallback,
}: {
  src: string | null | undefined;
  className?: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={className} onError={() => setFailed(true)} />;
}
