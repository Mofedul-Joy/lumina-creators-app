"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { clientLogin, setClientToken } from "@/lib/auth";

export default function ClientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });

  const login = useMutation({
    mutationFn: () => clientLogin(email, password),
    onSuccess: (data) => {
      setClientToken(data.access_token, data.refresh_token);
      router.push("/client/dashboard");
    },
    onError: (err) => setError((err as Error).message),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const nextErrors = {
      email: email ? "" : "Enter your email.",
      password: password ? "" : "Enter your password.",
    };
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;
    login.mutate();
  }

  return (
    <AuthCard title="Client sign in" subtitle="Access your read-only dashboard.">
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
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          error={fieldErrors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" loading={login.isPending}>
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
