"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAdminToken } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/admin";
import { isAuthError } from "@/lib/api";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border)]/40 px-6 py-4 last:border-0">
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      <span className="text-sm font-medium text-[var(--color-text)]">{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-lumina mt-6 overflow-hidden rounded-[var(--radius-card)]">
      <div className="border-b border-[var(--color-border)] px-6 py-4">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => {
    setHasToken(!!getAdminToken());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !hasToken) router.replace("/admin/login");
  }, [ready, hasToken, router]);

  const q = useQuery({ queryKey: ["settings"], queryFn: getPlatformSettings, enabled: ready && hasToken, retry: false });
  useEffect(() => {
    if (q.isError && isAuthError(q.error)) router.replace("/admin/login");
  }, [q.isError, q.error, router]);

  if (!ready || !hasToken)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );

  const s = q.data;
  const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Operations Terminal</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Settings</h1>
        <p className="mt-2 max-w-xl text-[var(--color-text-secondary)]">
          How the platform is configured. These are set at deploy. Changing them updates the live environment.
        </p>
        <AdminTabs />

        {!s ? (
          <p className="mt-10 text-sm text-[var(--color-text-secondary)]">Loading configuration…</p>
        ) : (
          <>
            <Section title="Platform">
              <Row label="Environment"><StatusBadge status={s.environment === "production" ? "active" : "draft"} /></Row>
              <Row label="Media storage">{s.storage === "r2" ? "Cloudflare R2" : "Local (proxy)"}</Row>
            </Section>

            <Section title="Authentication">
              <Row label="Email verification on signup">
                <StatusBadge status={s.email_verification_required ? "active" : "draft"} />
              </Row>
              <Row label="Email provider">
                {s.email_provider === "resend" ? "Resend (HTTP)" : s.email_provider === "smtp" ? "SMTP" : "Not configured"}
              </Row>
            </Section>

            <Section title="Campaigns & payouts">
              <Row label="Campaign modes">
                <span className="flex gap-2">
                  {s.campaign_modes.map((m) => (
                    <span key={m} className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
                      {m === "create_new" ? "Original UGC" : "Approved clips"}
                    </span>
                  ))}
                </span>
              </Row>
              <Row label="Payout methods">
                <span className="flex gap-2">
                  {s.payout_methods.map((m) => (
                    <span key={m} className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
                      {cap(m)}
                    </span>
                  ))}
                </span>
              </Row>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}
