"use client";

// Drop-in Google auth for any realm's login/signup page — an "or log in with"
// (or "or sign up with") divider followed by a SideShift-style Google button.
// Place it AFTER the email form. Renders nothing until NEXT_PUBLIC_GOOGLE_CLIENT_ID
// is set, so pages are unchanged until Google is configured.
import { useState } from "react";
import { googleAuth } from "@/lib/auth";
import { GoogleSignInButton } from "./GoogleSignInButton";

const CONFIGURED = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function GoogleAuthBlock({
  realm,
  mode = "login",
  onSuccess,
}: {
  realm: "creator" | "admin" | "client";
  mode?: "login" | "signup";
  onSuccess: (access: string, refresh?: string) => void;
}) {
  const [err, setErr] = useState("");

  if (!CONFIGURED) return null;

  const dividerText = mode === "signup" ? "or sign up with" : "or log in with";
  const label = mode === "signup" ? "Sign up with Google" : "Log in with Google";

  async function handle(code: string) {
    setErr("");
    try {
      const r = await googleAuth(realm, code);
      onSuccess(r.access_token, r.refresh_token);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Google sign-in failed.");
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
        <span className="h-px flex-1 bg-[var(--color-border)]" />
        <span>{dividerText}</span>
        <span className="h-px flex-1 bg-[var(--color-border)]" />
      </div>
      <GoogleSignInButton label={label} onCode={handle} />
      {err ? <p className="text-center text-sm text-[var(--color-danger,#ef6a6a)]">{err}</p> : null}
    </div>
  );
}
