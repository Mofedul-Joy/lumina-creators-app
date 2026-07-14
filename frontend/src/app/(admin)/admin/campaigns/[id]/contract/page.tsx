"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/AdminShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { getCampaignContract, updateCampaignContract, type ContractTemplate } from "@/lib/admin";
import { getAdminToken } from "@/lib/auth";
import { isAuthError, retryNonAuth} from "@/lib/api";
import { ContractDocument } from "@/components/contracts/ContractDocument";

export default function ContractEditorPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [form, setForm] = useState<{ title: string; subtitle: string; company_name: string; body: string } | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(getAdminToken());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !token) router.replace("/admin/login");
  }, [ready, token, router]);

  const q = useQuery({
    queryKey: ["contract-template", id],
    queryFn: () => getCampaignContract(id),
    enabled: ready && !!token && !!id,
    retry: retryNonAuth,
  });
  useEffect(() => {
    if (q.isError && isAuthError(q.error)) router.replace("/admin/login");
  }, [q.isError, q.error, router]);

  // Seed the editable form once when the template loads.
  useEffect(() => {
    if (q.data && !form) {
      const t: ContractTemplate = q.data;
      setForm({ title: t.title, subtitle: t.subtitle, company_name: t.company_name ?? "", body: t.body });
      setPreview(t.preview);
    }
  }, [q.data, form]);

  const tokens = q.data?.merge_tokens ?? [];
  const dirty = useMemo(() => {
    if (!q.data || !form) return false;
    return form.title !== q.data.title || form.subtitle !== q.data.subtitle ||
      (form.company_name ?? "") !== (q.data.company_name ?? "") || form.body !== q.data.body;
  }, [q.data, form]);

  async function save() {
    if (!form || busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateCampaignContract(id, form);
      setPreview(updated.preview);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      q.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the contract.");
    } finally {
      setBusy(false);
    }
  }

  function insertToken(tok: string) {
    setForm((f) => (f ? { ...f, body: `${f.body}{{${tok}}}` } : f));
  }

  if (!ready || !token || q.isLoading || !form) {
    return (
      <div className="min-h-[100dvh]">
        <AdminShell />
        <main className="mx-auto max-w-6xl px-6 py-10">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-6 h-96 w-full" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={`/admin/campaigns/${id}`} className="text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]">← Back to campaign</Link>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-text)]">Edit contract</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              This agreement is auto-sent to each creator when they join. Merge fields fill in per creator.
            </p>
          </div>
          <button
            onClick={save}
            disabled={busy || !dirty}
            className="inline-flex min-h-10 cursor-pointer items-center rounded-full bg-[var(--color-brand)] px-6 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Saving…" : saved ? "Saved" : "Save contract"}
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* editor */}
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Title</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1.5 min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Company name</span>
                <input
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  placeholder="Defaults to the campaign brand"
                  className="mt-1.5 min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Subtitle</span>
              <input
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                className="mt-1.5 min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
              />
            </label>

            <div>
              <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Merge fields (click to insert)</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tokens.map((t) => (
                  <button
                    key={t}
                    onClick={() => insertToken(t)}
                    className="cursor-pointer rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 font-mono text-[11px] text-[var(--color-text-secondary)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-text)]"
                  >
                    {`{{${t}}}`}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Agreement body (Markdown)</span>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={26}
                spellCheck={false}
                className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 font-mono text-[13px] leading-6 text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
              />
            </label>
            {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
          </section>

          {/* live preview */}
          <section>
            <span className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Preview (last saved)</span>
            <article className="card-lumina mt-2 max-h-[76vh] overflow-y-auto rounded-[var(--radius-card)] bg-[var(--color-surface)] p-6">
              <p className="text-center text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">{form.subtitle}</p>
              <ContractDocument body={preview} />
            </article>
            {dirty ? <p className="mt-2 text-xs text-[var(--color-text-muted)]">Save to refresh the preview with your latest edits.</p> : null}
          </section>
        </div>
      </main>
    </div>
  );
}
