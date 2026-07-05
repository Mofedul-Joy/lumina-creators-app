"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { creatorCheckEmail, creatorLogin, creatorSetPassword, setAuthToken } from "@/lib/auth";
import { ApiError } from "@/lib/api";

type Mode = "checking" | "returning" | "new" | "no-email";

function SuccessInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const email = sp.get("email") ?? "";
  const [mode, setMode] = useState<Mode>(email ? "checking" : "no-email");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    creatorCheckEmail(email).then((res) => {
      if (cancelled) return;
      setMode(res.exists && res.password_set ? "returning" : "new");
    }).catch(() => !cancelled && setMode("new"));
    return () => { cancelled = true; };
  }, [email]);

  function continueToDashboard() {
    router.push("/dashboard");
  }

  async function handleReturning(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await creatorLogin(email, password);
      if (res.status === "ok") {
        setAuthToken(res.access_token, res.refresh_token);
        continueToDashboard();
      } else if (res.status === "password_not_set") {
        setMode("new");
      } else {
        setError("Check your inbox — we need you to verify your email first.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleNew(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    try {
      const res = await creatorSetPassword(email, password);
      setAuthToken(res.access_token, res.refresh_token);
      continueToDashboard();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        // Race: password got set elsewhere between check-email and now.
        setMode("returning");
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Submission received</p>

        {mode === "checking" ? (
          <p className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">One moment…</p>
        ) : mode === "no-email" ? (
          <div className="mt-6 space-y-3 text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">Your post is in.</p>
            <Link href="/login" className="inline-block text-sm text-[var(--color-brand)] underline">Go to your dashboard</Link>
          </div>
        ) : mode === "returning" ? (
          <form onSubmit={handleReturning} className="mt-6 space-y-3">
            <h1 className="text-center text-2xl font-semibold text-[var(--color-text)]">Welcome back</h1>
            <p className="text-center text-sm text-[var(--color-text-secondary)]">Sign in with {email} to continue.</p>
            <input
              type="password" required autoFocus placeholder="Password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
            />
            {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
            <button type="submit" disabled={busy} className="min-h-11 w-full cursor-pointer rounded-full bg-[var(--color-brand)] text-sm font-semibold text-[var(--color-on-brand)] disabled:opacity-50">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleNew} className="mt-6 space-y-3">
            <h1 className="text-center text-2xl font-semibold text-[var(--color-text)]">Create your password</h1>
            <p className="text-center text-sm text-[var(--color-text-secondary)]">One last step for {email}.</p>
            <input
              type="password" required autoFocus placeholder="Create password (min. 8 characters)"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
            />
            <input
              type="password" required placeholder="Confirm password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
            />
            {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
            <button type="submit" disabled={busy} className="min-h-11 w-full cursor-pointer rounded-full bg-[var(--color-brand)] text-sm font-semibold text-[var(--color-on-brand)] disabled:opacity-50">
              {busy ? "Saving…" : "Create password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function CampaignSuccessPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[100dvh] items-center justify-center"><p className="text-sm text-[var(--color-text-secondary)]">Loading…</p></main>}>
      <SuccessInner />
    </Suspense>
  );
}
