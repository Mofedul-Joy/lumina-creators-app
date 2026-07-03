"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AdminNav } from "@/components/admin/AdminNav";
import { BannerInput } from "@/components/admin/BannerInput";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  createCampaign,
  listAdminClients,
  publishCampaign,
  type CampaignCreate,
} from "@/lib/admin";

const PLATFORMS = ["instagram", "tiktok", "youtube", "twitter", "facebook"];

const labelCls = "block text-sm font-medium text-[var(--color-text)]";
const controlCls =
  "min-h-11 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-base text-[var(--color-text)] outline-none focus-visible:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]";

export default function NewCampaignPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"create_new" | "copy_paste">("create_new");
  const [f, setF] = useState({
    name: "",
    brand_name: "",
    brand_logo_url: "",
    description: "",
    cpm_rate: "",
    budget: "",
    min_retention_days: "30",
    brief_script: "",
    content_drive_url: "",
    caption_rules: "",
    required_mentions: "",
  });
  const [platforms, setPlatforms] = useState<string[]>(["tiktok"]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "Campaign name is required.";
    if (!f.cpm_rate.trim() || Number(f.cpm_rate) <= 0) e.cpm_rate = "Enter a CPM rate.";
    if (!f.budget.trim() || Number(f.budget) <= 0) e.budget = "Enter a budget.";
    if (platforms.length === 0) e.platforms = "Pick at least one platform.";
    setErrors(e);
    const first = ["name", "cpm_rate", "budget", "platforms"].find((k) => e[k]);
    if (first) {
      const el = document.getElementById(`cf-${first}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLInputElement | null)?.focus?.();
    }
    return Object.keys(e).length === 0;
  }
  const [publishNow, setPublishNow] = useState(true);
  const [clientId, setClientId] = useState("");
  const clientsQ = useQuery({ queryKey: ["admin-clients"], queryFn: listAdminClients });

  function togglePlatform(p: string) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  const save = useMutation({
    mutationFn: async () => {
      const body: CampaignCreate = {
        name: f.name.trim(),
        mode,
        cpm_rate: Number(f.cpm_rate),
        budget: Number(f.budget),
        description: f.description.trim() || undefined,
        brand_name: f.brand_name.trim() || undefined,
        brand_logo_url: f.brand_logo_url.trim() || undefined,
        platforms,
        min_retention_days: Number(f.min_retention_days) || 30,
        client_id: clientId || undefined,
        caption_rules: f.caption_rules.trim() || undefined,
        required_mentions: f.required_mentions
          ? f.required_mentions.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        ...(mode === "create_new"
          ? { brief_script: f.brief_script.trim() }
          : { content_drive_url: f.content_drive_url.trim() }),
      };
      const created = await createCampaign(body);
      if (publishNow) await publishCampaign(created.id);
      return created;
    },
    onSuccess: () => router.push("/admin/campaigns"),
  });

  return (
    <div className="min-h-[100dvh]">
      <AdminNav />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <Link href="/admin/campaigns" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
          ← Campaigns
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--color-text)]">New campaign</h1>

        <div className="mt-8 space-y-6">
          {/* mode */}
          <div className="grid grid-cols-2 gap-3">
            {(["create_new", "copy_paste"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-[var(--radius-card)] border p-4 text-left transition ${
                  mode === m
                    ? "border-[var(--color-brand)] bg-[var(--color-surface)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-muted)]"
                }`}
              >
                <p className="font-medium text-[var(--color-text)]">
                  {m === "create_new" ? "Create new content" : "Repost approved clips"}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {m === "create_new" ? "Creator films original UGC from a brief." : "Creator reposts clips from a Drive folder."}
                </p>
              </button>
            ))}
          </div>

          <Field id="cf-name" requiredMark error={errors.name} label="Campaign name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Field label="Brand name" value={f.brand_name} onChange={(e) => setF({ ...f, brand_name: e.target.value })} />
          <BannerInput value={f.brand_logo_url} onChange={(v) => setF({ ...f, brand_logo_url: v })} />

          <div className="space-y-2">
            <label className={labelCls}>Client (brand account)</label>
            <select className={controlCls} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">No client — internal campaign</option>
              {(clientsQ.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? c.email}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--color-text-muted)]">
              Linked clients see this campaign&apos;s performance on their read-only dashboard.
            </p>
          </div>

          <div className="space-y-2">
            <label className={labelCls}>Description</label>
            <textarea rows={2} className={controlCls + " py-2"} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field id="cf-cpm_rate" requiredMark error={errors.cpm_rate} label="CPM ($ / 1,000 views)" type="number" value={f.cpm_rate} onChange={(e) => setF({ ...f, cpm_rate: e.target.value })} />
            <Field id="cf-budget" requiredMark error={errors.budget} label="Budget ($)" type="number" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} />
            <Field label="Min. retention (days)" type="number" value={f.min_retention_days} onChange={(e) => setF({ ...f, min_retention_days: e.target.value })} />
          </div>

          <div className="space-y-2" id="cf-platforms">
            <label className={labelCls}>Platforms<span className="ml-0.5 text-[var(--color-danger)]">*</span></label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    platforms.includes(p)
                      ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand)]"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {errors.platforms ? <p className="text-sm text-[var(--color-danger)]">{errors.platforms}</p> : null}
          </div>

          {mode === "create_new" ? (
            <div className="space-y-2">
              <label className={labelCls}>Brief / script</label>
              <textarea rows={4} className={controlCls + " py-2"} value={f.brief_script} onChange={(e) => setF({ ...f, brief_script: e.target.value })} placeholder="What should the creator film?" />
            </div>
          ) : (
            <Field label="Approved clips — Google Drive URL" value={f.content_drive_url} onChange={(e) => setF({ ...f, content_drive_url: e.target.value })} placeholder="https://drive.google.com/drive/folders/…" />
          )}

          <div className="space-y-2">
            <label className={labelCls}>Caption rules</label>
            <textarea rows={2} className={controlCls + " py-2"} value={f.caption_rules} onChange={(e) => setF({ ...f, caption_rules: e.target.value })} />
          </div>
          <Field label="Required mentions (comma-separated)" value={f.required_mentions} onChange={(e) => setF({ ...f, required_mentions: e.target.value })} />

          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
            Publish immediately (visible to creators)
          </label>

          {save.isError ? <p className="text-sm text-[var(--color-danger)]">{(save.error as Error).message}</p> : null}
          <div className="w-52">
            <Button loading={save.isPending} onClick={() => { if (validate()) save.mutate(); }}>
              {publishNow ? "Create & publish" : "Save draft"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
