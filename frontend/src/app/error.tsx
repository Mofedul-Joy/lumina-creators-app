"use client";

// App-wide error boundary — keeps a render crash inside the Lumina dark theme
// instead of falling through to Next's default unstyled page.
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface for debugging; no PII.
    console.error("[lumina] render error:", error);
  }, [error]);

  return (
    <div
      className="grid min-h-screen place-items-center p-6"
      style={{ background: "var(--color-bg)", color: "var(--color-text)" }}
    >
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-semibold tracking-wide" style={{ color: "var(--color-brand)" }}>
          SOMETHING WENT WRONG
        </p>
        <h1 className="mt-2 text-2xl font-semibold">This page hit a snag.</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6" style={{ color: "var(--color-text-secondary)" }}>
          Try again — if it keeps happening, refresh the page or head back home.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full px-5 py-2.5 text-sm font-semibold transition"
            style={{ background: "var(--color-brand)", color: "var(--color-on-brand)" }}
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-full px-5 py-2.5 text-sm transition"
            style={{ color: "var(--color-text-secondary)", border: "1px solid var(--color-border)" }}
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
