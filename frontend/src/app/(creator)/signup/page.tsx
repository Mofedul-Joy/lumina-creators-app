"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { creatorSignup } from "@/lib/auth";

export default function CreatorSignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const signup = useMutation({
    mutationFn: () => creatorSignup(email, password, displayName),
    onSuccess: () => {
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
