"use client";

// Drop-in Google auth for any realm's login/signup page. Owns session-save + routing.
// Renders nothing until NEXT_PUBLIC_GOOGLE_CLIENT_ID is set.
//
// Behaviour:
// - signup + new account            → onboarding
// - signup + account already exists → "you already have an account" → /login
// - login  + existing account       → home (/dashboard, or realm dashboard)
// - login  + NO account (creator)   → shows a "Sign up with Google" button under the
//                                      red notice → signs them up → onboarding
// - login  + NO account (admin/client) → error notice (no self-signup for those realms)
import { useState } from "react";
import { useRouter } from "next/navigation";
import { googleAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { saveSession } from "@/lib/tokens";
import { GoogleSignInButton } from "./GoogleSignInButton";

const CONFIGURED = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function GoogleAuthBlock({
  realm,
  mode = "login",
}: {
  realm: "creator" | "admin" | "client";
  mode?: "login" | "signup";
}) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [noAccount, setNoAccount] = useState(false);       // login: google account has no Lumina account
  const [alreadyExists, setAlreadyExists] = useState(false); // signup: google account already has one

  if (!CONFIGURED) return null;

  const dividerText = mode === "signup" ? "or sign up with" : "or log in with";
  const label = mode === "signup" ? "Sign up with Google" : "Log in with Google";

  function land(access: string, refresh: string | undefined, toOnboarding: boolean) {
    saveSession(realm, access, refresh);
    const next = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null;
    if (realm === "admin") router.push("/admin/dashboard");
    else if (realm === "client") router.push("/client/dashboard");
    else router.push(next || (toOnboarding ? "/onboarding" : "/dashboard"));
  }

  // Primary button (login or signup depending on `mode`).
  async function handlePrimary(code: string) {
    setErr("");
    setNoAccount(false);
    setAlreadyExists(false);
    try {
      const r = await googleAuth(realm, code, mode === "signup");
      land(r.access_token, r.refresh_token, mode === "signup");
    } catch (e) {
      if (mode === "login" && realm === "creator" && e instanceof ApiError && e.status === 404) {
        setNoAccount(true); // offer the "Sign up with Google" path below
        return;
      }
      if (mode === "signup" && e instanceof ApiError && e.status === 409) {
        setAlreadyExists(true); // offer the "Log in with Google" path below
        return;
      }
      setErr(e instanceof Error ? e.message : "Google sign-in failed.");
    }
  }

  // Login-page fallback: the Google account has no Lumina account → sign UP → onboarding.
  async function handleSignupFallback(code: string) {
    setErr("");
    try {
      const r = await googleAuth("creator", code, true);
      land(r.access_token, r.refresh_token, true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Google sign-up failed.");
    }
  }

  // Signup-page fallback: the Google account already has a Lumina account → log IN → home.
  async function handleLoginFallback(code: string) {
    setErr("");
    try {
      const r = await googleAuth("creator", code, false);
      land(r.access_token, r.refresh_token, false);
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
      <GoogleSignInButton label={label} onCode={handlePrimary} />

      {noAccount ? (
        <div className="space-y-2 pt-1">
          <p className="text-center text-sm text-[var(--color-danger,#ef6a6a)]">
            No Lumina account for this Google account — create one to get started.
          </p>
          <GoogleSignInButton label="Sign up with Google" onCode={handleSignupFallback} />
        </div>
      ) : null}

      {alreadyExists ? (
        <div className="space-y-2 pt-1">
          <p className="text-center text-sm text-[var(--color-danger,#ef6a6a)]">
            You already have a Lumina account with this Google account — log in instead.
          </p>
          <GoogleSignInButton label="Log in with Google" onCode={handleLoginFallback} />
        </div>
      ) : null}

      {err ? <p className="text-center text-sm text-[var(--color-danger,#ef6a6a)]">{err}</p> : null}
    </div>
  );
}
