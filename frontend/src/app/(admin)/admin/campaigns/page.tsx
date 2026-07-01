"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import { getAdminToken } from "@/lib/auth";
import { archiveCampaign, listAdminCampaigns, publishCampaign } from "@/lib/admin";

const STATUS_COLOR: Record<string, string> = {
  active: "var(--color-brand)",
  draft: "var(--color-text-muted)",
  archived: "var(--color-danger)",
  paused: "var(--color-warning)",
  completed: "var(--color-text-secondary)",
};

export default function AdminCampaignsPage() {
  const qc = useQueryClient();
  const [hasToken, setHasToken] = useState(false);
  useEffect(() => setHasToken(!!getAdminToken()), []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => listAdminCampaigns(),
    enabled: hasToken,
    retry: false,
  });

  const publish = useMutation({
    mutationFn: (id: string) => publishCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-campaigns"] }),
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-campaigns"] }),
  });

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)]">
      <AdminNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">Campaigns</h1>
            <p className="mt-1 text-[var(--color-text-secondary)]">Create, publish, and manage every campaign.</p>
          </div>
          <Link
            href="/admin/campaigns/new"
            className="inline-flex min-h-11 items-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
          >
            New campaign
          </Link>
        </div>

        {!hasToken ? (
          <Notice>
            Sign in as an admin to manage campaigns.{" "}
            <Link href="/admin/login" className="text-[var(--color-brand)] underline">Admin sign in</Link>
          </Notice>
        ) : isLoading ? (
          <p className="text-[var(--color-text-muted)]">Loading…</p>
        ) : isError ? (
          <Notice>{(error as Error).message}</Notice>
        ) : data && data.length > 0 ? (
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-surface)] text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Campaign</th>
                  <th className="px-4 py-3 font-medium">Mode</th>
                  <th className="px-4 py-3 font-medium">CPM</th>
                  <th className="px-4 py-3 font-medium">Budget</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.map((c) => (
                  <tr key={c.id} className="bg-[var(--color-bg)]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--color-text)]">{c.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{c.brand_name ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {c.mode === "create_new" ? "Create new" : "Repost"}
                    </td>
                    <td className="tabular px-4 py-3 text-[var(--color-text)]">${c.cpm_rate}</td>
                    <td className="tabular px-4 py-3 text-[var(--color-text-secondary)]">${c.budget.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: STATUS_COLOR[c.status] }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[c.status] }} />
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.status === "draft" ? (
                        <button
                          className="cursor-pointer text-sm font-medium text-[var(--color-brand)] hover:underline"
                          onClick={() => publish.mutate(c.id)}
                        >
                          Publish
                        </button>
                      ) : c.status !== "archived" ? (
                        <button
                          className="cursor-pointer text-sm text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                          onClick={() => archive.mutate(c.id)}
                        >
                          Archive
                        </button>
                      ) : (
                        <span className="text-sm text-[var(--color-text-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Notice>No campaigns yet. Create your first one.</Notice>
        )}
      </main>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center text-[var(--color-text-secondary)]">
      {children}
    </div>
  );
}
