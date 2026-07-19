"use client";

// Custom "Sign in with Google" button (SideShift-style white pill) driving the
// Google OAuth 2.0 auth-code popup flow. On success it returns the one-time code,
// which the caller sends to /api/{realm}/auth/google; the backend exchanges it
// (client_id + client_secret) and issues a Lumina session.
//
// Renders nothing until NEXT_PUBLIC_GOOGLE_CLIENT_ID is set.
import { useEffect, useRef, useState } from "react";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GIS_SRC = "https://accounts.google.com/gsi/client";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { google?: any }
}

function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.google?.accounts?.oauth2) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("gis failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = GIS_SRC; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("gis failed"));
    document.head.appendChild(s);
  });
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z"/>
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z"/>
    </svg>
  );
}

export function GoogleSignInButton({ label, onCode }: { label: string; onCode: (code: string) => void }) {
  const codeClient = useRef<{ requestCode: () => void } | null>(null);
  const cb = useRef(onCode);
  cb.current = onCode;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !window.google?.accounts?.oauth2) return;
        codeClient.current = window.google.accounts.oauth2.initCodeClient({
          client_id: CLIENT_ID,
          scope: "openid email profile",
          ux_mode: "popup",
          callback: (resp: { code?: string }) => { if (resp.code) cb.current(resp.code); },
        });
        setReady(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <button
      type="button"
      disabled={!ready}
      onClick={() => codeClient.current?.requestCode()}
      className="flex min-h-11 w-full items-center justify-center gap-3 rounded-full border border-[var(--color-border)] bg-white px-5 text-sm font-medium text-[#1f1f1f] transition hover:bg-[#f2f2f2] disabled:opacity-60"
    >
      <GoogleLogo />
      <span>{label}</span>
    </button>
  );
}
