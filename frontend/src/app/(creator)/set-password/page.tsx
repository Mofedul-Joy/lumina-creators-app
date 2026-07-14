"use client";

import { FormEvent, Suspense, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { creatorSetPassword, setAuthToken } from "@/lib/auth";

function SetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const prefilled = params.get("email") ?? "";
  // Route straight to the campaign the visitor came in on (Bill's flow: sign up
  // from a campaign card → land inside that campaign). The post-signup onboarding
  // wizard is intentionally bypassed — profile completion now happens on-demand
  // when they try to join (ProfileGate popup). Falls back to the dashboard.
  const next = params.get("next") || "/dashboard";
  const [email, setEmail] = useState(prefilled);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "", confirm: "" });

  const setCreatorPassword = useMutation({
    mutationFn: () => creatorSetPassword(email, password),
    onSuccess: (data) => {
      setAuthToken(data.access_token, data.refresh_token);
      router.push(next);
    },
    onError: (err) => setError((err as Error).message),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const nextErrors = {
      email: email ? "" : "Enter your email.",
      password: password.length < 8 ? "Use at least 8 characters." : "",
      confirm: confirm !== password ? "Passwords don't match." : "",
    };
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password || nextErrors.confirm) return;
    setCreatorPassword.mutate();
  }

  return (
    <AuthCard title="Set your password" subtitle="Your email is verified — create a password to finish.">
      {error ? (
        <p role="alert" className="mb-4 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          error={fieldErrors.email}
          readOnly={!!prefilled}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          error={fieldErrors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Field
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          error={fieldErrors.confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        <Button type="submit" loading={setCreatorPassword.isPending}>
          Set password &amp; continue
        </Button>
      </form>
    </AuthCard>
  );
}

export default function CreatorSetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordInner />
    </Suspense>
  );
}
