"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { BannerInput } from "@/components/admin/BannerInput";
import { SharePageLink } from "@/components/admin/SharePageLink";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { SubmissionsSection } from "@/components/admin/SubmissionsSection";
import {
  archiveCampaign,
  type CampaignUpdate,
  getAdminCampaign,
  impersonateClient,
  publishCampaign,
  updateCampaign,
} from "@/lib/admin";
import { getAdminToken } from "@/lib/auth";
import { downloadCsv, isAuthError, retryNonAuth} from "@/lib/api";
import { fmtMoney } from "@/lib/format";

const ALL_PLATFORMS = ["instagram", "tiktok", "youtube", "twitter", "facebook"];
const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", twitter: "X", facebook: "Facebook",
};

type FormState = {
  name: string; brand_name: string; brand_logo_url: string; description: string;
  cpm_rate: string; budget: string; max_payout_per_creator: string; eligible_view_pct: string;
  min_retention_days: string; platforms: string[]; brief_script: string; content_drive_url: string;
  caption_rules: string; requirements_url: string;
};

function TextField({ label, value, onChange, placeholder, textarea }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-brand)] focus:outline-none" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-brand)] focus:outline-none" />
      )}
    </label>
  );
}

export default function AdminCampaignDetailPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saved, setSaved] = useState(false);
  const [showReqs, setShowReqs] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { setHasToken(!!getAdminToken()); setReady(true); }, []);
  useEffect(() => { if (ready && !hasToken) router.replace("/admin/login"); }, [ready, hasToken, router]);

  const q = useQuery({ queryKey: ["campaign", id], queryFn: () => getAdminCampaign(id), enabled: ready && hasToken, retry: retryNonAuth });
  useEffect(() => { if (q.isError && isAuthError(q.error)) router.replace("/admin/login"); }, [q.isError, q.error, router]);

  const c = q.data;
  useEffect(() => {
    if (c && !form) {
      setForm({
        name: c.name, brand_name: c.brand_name ?? "", brand_logo_url: c.brand_logo_url ?? "",
        description: c.description ?? "", cpm_rate: String(c.cpm_rate), budget: String(c.budget),
        max_payout_per_creator: c.max_payout_per_creator != null ? String(c.max_payout_per_creator) : "",
        eligible_view_pct: String(c.eligible_view_pct), min_retention_days: String(c.min_retention_days),
        platforms: c.platforms, brief_script: c.brief_script ?? "", content_drive_url: c.content_drive_url ?? "",
        caption_rules: c.caption_rules ?? "", requirements_url: c.requirements_url ?? "",
      });
    }
  }, [c, form]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["campaign", id] });
  const saveM = useMutation({
    mutationFn: (patch: CampaignUpdate) => updateCampaign(id, patch),
    onSuccess: () => { setSaved(true); refresh(); setTimeout(() => setSaved(false), 2000); },
  });
  const publishM = useMutation({ mutationFn: () => publishCampaign(id), onSuccess: refresh });
  const archiveM = useMutation({ mutationFn: () => archiveCampaign(id), onSuccess: refresh });
  const viewAsClientM = useMutation({
    mutationFn: () => impersonateClient(id),
    onSuccess: ({ access_token }) => {
      window.open(`/client/dashboard?impersonate_token=${encodeURIComponent(access_token)}`, "_blank");
    },
  });

  if (!ready || !hasToken)
    return <main className="flex min-h-[100dvh] items-center justify-center"><p className="text-sm text-[var(--color-text-secondary)]">Loading…</p></main>;

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }
  function save() {
    if (!form) return;
    saveM.mutate({
      name: form.name.trim(), brand_name: form.brand_name.trim(), brand_logo_url: form.brand_logo_url.trim(),
      description: form.description.trim(), cpm_rate: Number(form.cpm_rate), budget: Number(form.budget),
      max_payout_per_creator: form.max_payout_per_creator ? Number(form.max_payout_per_creator) : null,
      eligible_view_pct: Number(form.eligible_view_pct), min_retention_days: Number(form.min_retention_days),
      platforms: form.platforms, brief_script: form.brief_script.trim(),
      content_drive_url: form.content_drive_url.trim(), caption_rules: form.caption_rules.trim(),
      requirements_url: form.requirements_url.trim(),
    });
  }

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href={`/admin/campaigns/${id}`} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">← Back to campaign</Link>
        <AdminTabs />

        {!c || !form ? (
          <p className="mt-8 text-sm text-[var(--color-text-secondary)]">Loading campaign…</p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)]">{form.name || "Untitled campaign"}</h1>
                <StatusBadge status={c.status} />
              </div>
              <div className="flex items-center gap-2">
                {c.client_id ? (
                  <button
                    onClick={() => viewAsClientM.mutate()}
                    disabled={viewAsClientM.isPending}
                    className="cursor-pointer rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-[var(--color-text)] disabled:opacity-50"
                  >
                    {viewAsClientM.isPending ? "Opening…" : "View as client"}
                  </button>
                ) : null}
                <button
                  onClick={async () => {
                    setExporting(true);
                    try { await downloadCsv(`/api/admin/campaigns/${id}/export`, getAdminToken() ?? ""); }
                    finally { setExporting(false); }
                  }}
                  disabled={exporting}
                  className="cursor-pointer rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-[var(--color-text)] disabled:opacity-50"
                >
                  {exporting ? "Exporting…" : "Export CSV"}
                </button>
                {c.status === "draft" ? (
                  <button onClick={() => publishM.mutate()} disabled={publishM.isPending}
                    className="cursor-pointer rounded-full bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-[var(--color-on-brand)] disabled:opacity-50">Publish</button>
                ) : c.status !== "archived" ? (
                  <button onClick={() => archiveM.mutate()} disabled={archiveM.isPending}
                    className="cursor-pointer rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-red-400 hover:ring-red-500/25">Archive</button>
                ) : null}
                <button onClick={save} disabled={saveM.isPending}
                  className="cursor-pointer rounded-full bg-[var(--color-brand)] px-5 py-2 text-sm font-semibold text-[var(--color-on-brand)] disabled:opacity-50">
                  {saveM.isPending ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
              {/* editable form */}
              <div className="space-y-6">
                <section className="card-lumina rounded-[var(--radius-card)] p-6">
                  <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Basics</h2>
                  <div className="space-y-4">
                    <TextField label="Campaign name" value={form.name} onChange={(v) => set("name", v)} />
                    <TextField label="Brand name" value={form.brand_name} onChange={(v) => set("brand_name", v)} />
                    <BannerInput value={form.brand_logo_url} onChange={(v) => set("brand_logo_url", v)} />
                    <TextField label="Description" value={form.description} onChange={(v) => set("description", v)} textarea />
                  </div>
                </section>

                <section className="card-lumina rounded-[var(--radius-card)] p-6">
                  <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Economics</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <TextField label="CPM ($ / 1,000 views)" value={form.cpm_rate} onChange={(v) => set("cpm_rate", v)} />
                    <TextField label="Budget ($)" value={form.budget} onChange={(v) => set("budget", v)} />
                    <TextField label="Max payout / creator ($)" value={form.max_payout_per_creator} onChange={(v) => set("max_payout_per_creator", v)} placeholder="No cap" />
                    <TextField label="Eligible view %" value={form.eligible_view_pct} onChange={(v) => set("eligible_view_pct", v)} />
                    <TextField label="Min retention (days)" value={form.min_retention_days} onChange={(v) => set("min_retention_days", v)} />
                  </div>
                </section>

                <section className="card-lumina rounded-[var(--radius-card)] p-6">
                  <h2 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Content & rules</h2>
                  <div className="space-y-4">
                    <div>
                      <span className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">Platforms</span>
                      <div className="flex flex-wrap gap-2">
                        {ALL_PLATFORMS.map((p) => {
                          const on = form.platforms.includes(p);
                          return (
                            <button key={p} type="button"
                              onClick={() => set("platforms", on ? form.platforms.filter((x) => x !== p) : [...form.platforms, p])}
                              className={`rounded-full px-3 py-1 text-xs transition ${on ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}>
                              {PLATFORM_LABEL[p]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {c.mode === "create_new" ? (
                      <TextField label="Brief / script" value={form.brief_script} onChange={(v) => set("brief_script", v)} textarea />
                    ) : (
                      <TextField label="Content drive URL" value={form.content_drive_url} onChange={(v) => set("content_drive_url", v)} />
                    )}
                    <TextField label="Caption rules" value={form.caption_rules} onChange={(v) => set("caption_rules", v)} textarea />
                    <TextField label="Requirements URL" value={form.requirements_url} onChange={(v) => set("requirements_url", v)} />
                  </div>
                </section>

                <SharePageLink campaignId={id} shareToken={c.share_token} shareEnabled={c.share_enabled} />
              </div>

              {/* live creator preview */}
              <aside className="lg:sticky lg:top-24 lg:self-start">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Creator preview</p>
                <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <div className="relative h-28 w-full bg-gradient-to-br from-[var(--color-brand)]/40 to-[var(--color-bg-deep)]">
                    {form.brand_logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.brand_logo_url} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-[var(--color-text)]">{form.name || "Campaign name"}</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">{form.brand_name || "Brand"}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div><p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">CPM rate</p><p className="tabular font-semibold text-[var(--color-brand-soft)]">{fmtMoney(form.cpm_rate || 0)}</p></div>
                      <div><p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Max payout</p><p className="tabular font-semibold text-[var(--color-text)]">{form.max_payout_per_creator ? fmtMoney(form.max_payout_per_creator) : "No cap"}</p></div>
                      <div><p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Budget</p><p className="tabular text-[var(--color-text)]">{fmtMoney(form.budget || 0)}</p></div>
                      <div><p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Budget used</p><p className="tabular text-[var(--color-text)]">{fmtMoney(c.spent_amount)}</p></div>
                    </div>
                    <div className="mt-4">
                      <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Accepted platforms</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {form.platforms.length ? form.platforms.map((p) => (
                          <span key={p} className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-xs text-[var(--color-text-secondary)]">{PLATFORM_LABEL[p]}</span>
                        )) : <span className="text-xs text-[var(--color-text-muted)]">None selected</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowReqs(true)}
                      className="mt-5 w-full cursor-pointer rounded-xl bg-[var(--color-brand)]/15 px-4 py-2.5 text-center text-sm font-medium text-[var(--color-brand-soft)] transition hover:bg-[var(--color-brand)]/25"
                    >
                      View requirements →
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}

        {/* this campaign's submissions — Bill: "view a campaign… the videos people
            submitted for this campaign" */}
        {c ? (
          <div className="mt-10">
            <SubmissionsSection campaignId={id} />
          </div>
        ) : null}

        {/* requirements modal — what a creator sees before entering */}
        {showReqs && form ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
            <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand)]">Campaign requirements</p>
                  <h3 className="mt-1 text-xl font-semibold text-[var(--color-text)]">{form.name || "Campaign"}</h3>
                </div>
                <button onClick={() => setShowReqs(false)} className="cursor-pointer rounded-full p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" aria-label="Close">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">CPM rate</p><p className="tabular font-semibold text-[var(--color-brand-soft)]">{fmtMoney(form.cpm_rate || 0)}</p></div>
                <div><p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Max payout</p><p className="tabular font-semibold text-[var(--color-text)]">{form.max_payout_per_creator ? fmtMoney(form.max_payout_per_creator) : "No cap"}</p></div>
                <div><p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Min retention</p><p className="tabular text-[var(--color-text)]">{form.min_retention_days} days</p></div>
              </div>

              <div className="mt-5">
                <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Platforms</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {form.platforms.length ? form.platforms.map((p) => (
                    <span key={p} className="rounded-full bg-[var(--color-surface-2)] px-2.5 py-0.5 text-xs text-[var(--color-text-secondary)]">{PLATFORM_LABEL[p] ?? p}</span>
                  )) : <span className="text-xs text-[var(--color-text-muted)]">Any</span>}
                </div>
              </div>

              {c?.mode === "create_new" && form.brief_script ? (
                <Section title="Brief / script">{form.brief_script}</Section>
              ) : c?.mode === "copy_paste" && form.content_drive_url ? (
                <Section title="Approved clips">
                  <a href={form.content_drive_url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand)] hover:underline">{form.content_drive_url}</a>
                </Section>
              ) : null}
              {form.caption_rules ? <Section title="Caption rules">{form.caption_rules}</Section> : null}
              {form.requirements_url ? (
                <Section title="Full requirements">
                  <a href={form.requirements_url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand)] hover:underline">{form.requirements_url}</a>
                </Section>
              ) : null}
              {form.description ? <Section title="About">{form.description}</Section> : null}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{children}</p>
    </div>
  );
}
