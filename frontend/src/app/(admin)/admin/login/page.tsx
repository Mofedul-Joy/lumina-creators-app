"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { GoogleAuthBlock } from "@/components/auth/GoogleAuthBlock";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { adminLogin, setAdminToken } from "@/lib/auth";
import { useRedirectIfAuthed } from "@/lib/useRedirectIfAuthed";

function AdminLoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  // Persistent login: an already-signed-in admin skips the form entirely.
  const redirecting = useRedirectIfAuthed("admin", "/admin/dashboard");
  const [email, setEmail] = useState("");
  // invite links prefill the email (?email=…)
  useEffect(() => { const e = sp.get("email"); if (e) setEmail(e); }, [sp]);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });

  const login = useMutation({
    mutationFn: () => adminLogin(email, password),
    onSuccess: (data) => {
      setAdminToken(data.access_token, data.refresh_token);
      router.push("/admin/dashboard");
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

  if (redirecting) return null;

  return (
    <AuthCard title="Admin sign in" subtitle="Manage Lumina creator operations." hideMarketing eyebrow="Lumina Admin">
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
      <GoogleAuthBlock realm="admin" mode="login" />
    </AuthCard>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginInner />
    </Suspense>
  );
}
