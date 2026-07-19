"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { GoogleAuthBlock } from "@/components/auth/GoogleAuthBlock";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  creatorCheckEmail,
  creatorLogin,
  creatorSetPassword,
  setAuthToken,
} from "@/lib/auth";

type Step = "email" | "password" | "set-password";

export default function CreatorLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");

  function finish(token: string, refresh?: string) {
    setAuthToken(token, refresh);
    // Route to the campaign the visitor came in on (?next=/campaigns/…) if
    // present, else the dashboard. The post-signup onboarding wizard is bypassed
    // — profile completion happens on-demand at join time (ProfileGate popup).
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next || "/dashboard");
  }

  const checkEmail = useMutation({
    mutationFn: () => creatorCheckEmail(email),
    onSuccess: (data) => {
      if (!data.exists) {
        setFieldError("No creator account found for this email.");
        return;
      }
      setStep(data.password_set ? "password" : "set-password");
      setPassword("");
    },
    onError: (err) => setError((err as Error).message),
  });

  const login = useMutation({
    mutationFn: () => creatorLogin(email, password),
    onSuccess: (data) => {
      if (data.status === "password_not_set") {
        setStep("set-password");
        return;
      }
      if (data.status === "email_not_verified") {
        // A fresh code was sent — go enter it.
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
        return;
      }
      finish(data.access_token, data.refresh_token);
    },
    onError: (err) => setError((err as Error).message),
  });

  const setCreatorPassword = useMutation({
    mutationFn: () => creatorSetPassword(email, password),
    onSuccess: (data) => finish(data.access_token, data.refresh_token),
    onError: (err) => setError((err as Error).message),
  });

  function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldError("");
    if (!email) {
      setFieldError("Enter your email.");
      return;
    }
    checkEmail.mutate();
  }

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldError("");
    if (!password) {
      setFieldError("Enter your password.");
      return;
    }
    (step === "set-password" ? setCreatorPassword : login).mutate();
  }

  return (
    <AuthCard
      title={step === "set-password" ? "Set your password" : "Creator sign in"}
      subtitle="Access your creator account."
    >
      {error ? (
        <p role="alert" className="mb-4 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      {step === "email" ? (
        <>
        <GoogleAuthBlock realm="creator" text="signin_with" onSuccess={finish} />
        <form className="space-y-4" onSubmit={submitEmail}>
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            error={fieldError}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" loading={checkEmail.isPending}>
            Continue
          </Button>
          <p className="text-sm text-[var(--color-text-secondary)]">
            New to Lumina?{" "}
            <Link href="/signup" className="font-medium text-[var(--color-brand)] hover:underline">
              Create an account
            </Link>
          </p>
        </form>
        </>
      ) : (
        <form className="space-y-4" onSubmit={submitPassword}>
          <Field label="Email" type="email" value={email} readOnly />
          <Field
            label={step === "set-password" ? "New password" : "Password"}
            type="password"
            autoComplete={step === "set-password" ? "new-password" : "current-password"}
            value={password}
            error={fieldError}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button
            type="submit"
            loading={login.isPending || setCreatorPassword.isPending}
          >
            {step === "set-password" ? "Set password" : "Sign in"}
          </Button>
          <button
            type="button"
            className="min-h-11 cursor-pointer text-sm font-medium text-[var(--color-text-secondary)] transition duration-200 hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
            onClick={() => {
              setStep("email");
              setPassword("");
              setError("");
              setFieldError("");
            }}
          >
            Use a different email
          </button>
        </form>
      )}
    </AuthCard>
  );
}
