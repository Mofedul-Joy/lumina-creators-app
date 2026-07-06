"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { creatorSetPassword, setAuthToken } from "@/lib/auth";

export default function CreatorSetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });

  const setCreatorPassword = useMutation({
    mutationFn: () => creatorSetPassword(email, password),
    onSuccess: (data) => {
      setAuthToken(data.access_token, data.refresh_token);
      router.push("/dashboard");
    },
    onError: (err) => setError((err as Error).message),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const nextErrors = {
      email: email ? "" : "Enter your email.",
      password: password ? "" : "Enter a new password.",
    };
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;
    setCreatorPassword.mutate();
  }

  return (
    <AuthCard title="Set your password" subtitle="Create a password for your creator account.">
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
        <Button type="submit" loading={setCreatorPassword.isPending}>
          Set password
        </Button>
      </form>
    </AuthCard>
  );
}
