"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Video review moved to its own standalone page (/admin/video-review). Keep this
// route as a redirect so any old bookmarks / deep-links (?status=…) still land.
function Redirect() {
  const router = useRouter();
  const sp = useSearchParams();
  useEffect(() => {
    const qs = sp.toString();
    router.replace(`/admin/video-review${qs ? `?${qs}` : ""}`);
  }, [router, sp]);
  return (
    <main className="flex min-h-[100dvh] items-center justify-center">
      <p className="text-sm text-[var(--color-text-secondary)]">Redirecting to Video Review…</p>
    </main>
  );
}

export default function AdminSubmissionsRedirect() {
  return (
    <Suspense fallback={<main className="flex min-h-[100dvh] items-center justify-center"><p className="text-sm text-[var(--color-text-secondary)]">Loading…</p></main>}>
      <Redirect />
    </Suspense>
  );
}
