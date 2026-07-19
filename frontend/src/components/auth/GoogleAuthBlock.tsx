"use client";

// Drop-in "Continue with Google" block for any realm's login/signup page.
// Renders nothing until NEXT_PUBLIC_GOOGLE_CLIENT_ID is set, so pages look
// unchanged until Google is configured. On success it hands the new session's
// tokens to the page's own onSuccess (which saves the session + routes).
import { useState } from "react";
import { googleAuth } from "@/lib/auth";
import { GoogleSignInButton } from "./GoogleSignInButton";

const CONFIGURED = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function GoogleAuthBlock({
  realm,
  text = "continue_with",
  onSuccess,
}: {
  realm: "creator" | "admin" | "client";
  text?: "signin_with" | "signup_with" | "continue_with";
  onSuccess: (access: string, refresh?: string) => void;
}) {
  const [err, setErr] = useState("");

  if (!CONFIGURED) return null;

  async function handle(credential: string) {
    setErr("");
    try {
      const r = await googleAuth(realm, credential);
      onSuccess(r.access_token, r.refresh_token);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Google sign-in failed.");
    }
  }

  return (
    <div className="mb-5 space-y-3">
      <GoogleSignInButton text={text} onCredential={handle} />
      {err ? <p className="text-center text-sm text-[var(--color-danger,#ef6a6a)]">{err}</p> : null}
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        <span>or</span>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
    </div>
  );
}
