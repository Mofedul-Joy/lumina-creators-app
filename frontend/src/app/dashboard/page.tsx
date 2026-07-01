"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getAuthToken } from "@/lib/auth";
import { getCompletion } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setToken(getAuthToken());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  const completionQ = useQuery({
    queryKey: ["completion"],
    queryFn: () => getCompletion(token ?? ""),
    enabled: ready && !!token,
    retry: false,
  });

  useEffect(() => {
    if (completionQ.data && !completionQ.data.completed) router.replace("/onboarding");
  }, [completionQ.data, router]);

  useEffect(() => {
    if (completionQ.isError) router.replace("/login");
  }, [completionQ.isError, router]);

  if (!ready || !token || completionQ.isLoading || !completionQ.data?.completed)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );

  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <section className="w-full max-w-[420px] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <p className="mb-2 text-sm font-medium text-[var(--color-brand)]">Lumina Creators</p>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Browse campaigns</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
          Your profile is complete. Campaign browsing lands here in the next stage.
        </p>
        <Link
          href="/onboarding"
          className="mt-4 inline-block text-sm text-[var(--color-brand)] underline"
        >
          Edit profile
        </Link>
      </section>
    </main>
  );
}
