"use client";

import { FormEvent, Suspense, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { resendEmailCode, setAuthToken, verifyEmailCode } from "@/lib/auth";

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const next = params.get("next");   // "set-password" for the email-first signup
  const after = params.get("after"); // campaign to land in once onboarding is done
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const verify = useMutation({
    mutationFn: () => verifyEmailCode(email, code.trim()),
    onSuccess: (data) => {
      setAuthToken(data.access_token, data.refresh_token);
      const afterQ = after ? `&next=${encodeURIComponent(after)}` : "";
      // Email-first signup: verified, now choose a password (campaign rides along
      // as ?next). Otherwise straight into the mandatory onboarding flow.
      router.push(
        next === "set-password"
          ? `/set-password?email=${encodeURIComponent(email)}${afterQ}`
          : `/onboarding${after ? `?next=${encodeURIComponent(after)}` : ""}`,
      );
    },
    onError: (err) => setError((err as Error).message),
  });

  const resend = useMutation({
    mutationFn: () => resendEmailCode(email),
    onSuccess: () => setNotice("A new code is on its way. Check your inbox."),
    onError: (err) => setError((err as Error).message),
  });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    verify.mutate();
  }

  return (
    <AuthCard
      title="Check your email"
      subtitle={email ? `We sent a 6-digit code to ${email}. Enter it to verify your account.` : "Enter the 6-digit code we emailed you."}
    >
      {error ? <p role="alert" className="mb-4 text-sm text-[var(--color-danger)]">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-[var(--color-brand)]">{notice}</p> : null}

      <form className="space-y-4" onSubmit={submit}>
        <Field
          label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          className="tracking-[0.4em] text-center text-lg"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
        <Button type="submit" loading={verify.isPending}>Verify &amp; continue</Button>
      </form>

      <p className="mt-6 text-sm text-[var(--color-text-secondary)]">
        Didn&apos;t get it?{" "}
        <button
          type="button"
          className="cursor-pointer font-medium text-[var(--color-brand)] hover:underline disabled:opacity-50"
          disabled={resend.isPending}
          onClick={() => { setError(""); resend.mutate(); }}
        >
          Resend code
        </button>
      </p>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
