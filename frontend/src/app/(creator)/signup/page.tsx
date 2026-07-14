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
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string }>({});

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
    mutationFn: () => creatorSignup(email, undefined, undefined, invite ?? undefined),
    onSuccess: (data) => {
      const e = encodeURIComponent(email);
      if (data.status === "ok") {
        // Email verification disabled — go straight to set a password.
        setAuthToken(data.access_token, data.refresh_token);
        router.push(`/set-password?email=${e}`);
        return;
      }
      // Account created unverified — enter the emailed code, then set a password.
      router.push(`/verify-email?email=${e}&next=set-password`);
    },
    onError: (err) => setError((err as Error).message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const errs: { email?: string } = {};
    if (!email) errs.email = "Enter your email.";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    signup.mutate();
  }

  return (
    <AuthCard
      title="Create your creator account"
      subtitle="Enter your email — we'll send you a 6-digit code to verify it, then you'll set a password."
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
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          error={fieldErrors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Button type="submit" loading={signup.isPending}>
          Send verification code
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
