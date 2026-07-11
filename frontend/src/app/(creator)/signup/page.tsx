"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { peekInvite } from "@/lib/api";
import { creatorSignup, setAuthToken } from "@/lib/auth";

export default function CreatorSignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // Arrived from an admin invite link (/signup?invite=…). The token is passed
  // through to signup so the invite is marked used; if the admin invited a
  // specific address, prefill it.
  const [invite, setInvite] = useState<string | null>(null);
  const [invited, setInvited] = useState(false);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite");
    if (!token) return;
    setInvite(token);
    peekInvite(token)
      .then((i) => {
        setInvited(true);
        if (i.email) setEmail(i.email);
      })
      .catch(() => setInvite(null));   // bad/expired link → plain signup
  }, []);

  const signup = useMutation({
    mutationFn: () => creatorSignup(email, password, displayName, invite ?? undefined),
    onSuccess: (data) => {
      if (data.status === "ok") {
        // Email verification disabled — straight into onboarding.
        setAuthToken(data.access_token, data.refresh_token);
        router.push("/onboarding");
        return;
      }
      // Account created unverified — go enter the emailed code.
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    },
    onError: (err) => setError((err as Error).message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const errs: { email?: string; password?: string } = {};
    if (!email) errs.email = "Enter your email.";
    if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    signup.mutate();
  }

  return (
    <AuthCard
      title="Create your creator account"
      subtitle="Join Lumina campaigns and get paid per 1,000 views."
    >
      {invited ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/10 p-4">
          <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-brand)] text-[var(--color-on-brand)]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            You&apos;ve been invited to Lumina Creators. Finish signing up to set up your profile.
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mb-4 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      <form className="space-y-4" onSubmit={submit}>
        <Field
          label="Display name"
          autoComplete="name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          error={fieldErrors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          error={fieldErrors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" loading={signup.isPending}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-sm text-[var(--color-text-secondary)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[var(--color-brand)] hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
