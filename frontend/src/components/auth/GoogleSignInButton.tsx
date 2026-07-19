"use client";

// "Sign in with Google" via Google Identity Services (ID-token flow). Renders
// Google's own button; on success it hands the ID-token (credential) back to the
// caller, which exchanges it at /api/{realm}/auth/google for a Lumina session.
//
// Renders nothing until NEXT_PUBLIC_GOOGLE_CLIENT_ID is configured, so the code
// can ship inert and light up the moment the env var is set.
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
    if (window.google?.accounts?.id) return resolve();
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

export function GoogleSignInButton({
  onCredential,
  text = "signin_with",
}: {
  onCredential: (credential: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !ref.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (resp: { credential?: string }) => { if (resp.credential) cb.current(resp.credential); },
          ux_mode: "popup",
        });
        ref.current.innerHTML = "";
        window.google.accounts.id.renderButton(ref.current, {
          theme: "filled_black", size: "large", text, shape: "pill", width: 320, logo_alignment: "center",
        });
      })
      .catch(() => setFailed(true));
    return () => { cancelled = true; };
  }, [text]);

  if (!CLIENT_ID || failed) return null;
  return <div ref={ref} className="flex justify-center" />;
}
