"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { BannerInput } from "@/components/admin/BannerInput";
import { getTemplate, type CampaignTemplate } from "@/lib/campaignTemplates";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  createCampaign,
  publishCampaign,
  type BonusMilestone,
  type CampaignCreate,
  type PaymentType,
} from "@/lib/admin";

/* ───────────────────────── shared styling helpers ───────────────────────── */

const labelCls = "block text-sm font-medium text-[var(--color-text)]";
const controlCls =
  "min-h-11 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-base text-[var(--color-text)] outline-none transition focus-visible:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]";
const sectionCls = "space-y-6";

/* ───────────────────────── static option lists ───────────────────────── */

const JOB_TYPES = [
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "content_creator", label: "Content Creator" },
  { value: "ambassador", label: "Ambassador" },
  { value: "other", label: "Other" },
] as const;

const CREATOR_TYPES = [
  { value: "ugc_ads", label: "UGC Ads" },
  { value: "high_volume_ugc", label: "High-Volume UGC" },
  { value: "influencer", label: "Influencer" },
  { value: "creator_manager", label: "Creator Manager" },
  { value: "other", label: "Other" },
] as const;

const PAYMENT_TYPES: { value: PaymentType; label: string; blurb: string }[] = [
  { value: "fixed", label: "Fixed", blurb: "Recurring flat payment" },
  { value: "cpm", label: "CPM", blurb: "Paid per 1,000 views" },
  { value: "mixed", label: "Mixed", blurb: "Fixed pay + CPM bonus" },
  { value: "per_hour", label: "Per Hour", blurb: "Hourly rate" },
  { value: "per_post", label: "Per Post", blurb: "Flat rate per post" },
];

const PLATFORM_FOCUS_OPTIONS = ["tiktok", "instagram", "youtube", "twitter", "facebook", "snapchat"];

const AGE_REQUIREMENTS = ["any", "18+", "18-24", "21+", "25+"];

const STEPS = [
  { n: 1, label: "Job Details" },
  { n: 2, label: "Pay & Rates" },
  { n: 3, label: "Bonuses" },
  { n: 4, label: "Examples" },
  { n: 5, label: "Targeting" },
  { n: 6, label: "Banner & Post" },
] as const;

/* ───────────────────────── minimal markdown editor ───────────────────────── */

// No rich-text package is installed (see package.json), so step 1 rolls a
// lightweight markdown-style textarea: format buttons inject markdown syntax,
// and a small hand-written renderer produces the live preview (bold/italic/
// strike/links/bullets) without pulling in a new dependency.
function mdToHtml(src: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = esc(src).split("\n");
  const html: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw;
    const isBullet = /^\s*[-*]\s+/.test(line);
    if (isBullet) {
      if (!inList) {
        html.push("<ul class='list-disc pl-5 space-y-1'>");
        inList = true;
      }
      html.push(`<li>${inlineMd(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
    if (line.trim() === "") {
      html.push("<br/>");
    } else {
      html.push(`<p>${inlineMd(line)}</p>`);
    }
  }
  if (inList) html.push("</ul>");
  return html.join("");
}

function inlineMd(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/\[(.+?)\]\((.+?)\)/g, "<a href='$2' class='underline text-[var(--color-brand)]' target='_blank' rel='noreferrer'>$1</a>");
}

function RichTextEditor({ value, onChange, max = 1000 }: { value: string; onChange: (v: string) => void; max?: number }) {
  const [showPreview, setShowPreview] = useState(false);

  function wrapSelection(before: string, after: string = before) {
    const el = document.getElementById("wizard-richtext") as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || "text";
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next.slice(0, max));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    });
  }

  function insertLink() {
    const el = document.getElementById("wizard-richtext") as HTMLTextAreaElement | null;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || "link text";
    const next = value.slice(0, start) + `[${selected}](https://)` + value.slice(end);
    onChange(next.slice(0, max));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => wrapSelection("**")} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-bold text-[var(--color-text)] hover:border-[var(--color-brand)]">B</button>
        <button type="button" onClick={() => wrapSelection("_")} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs italic text-[var(--color-text)] hover:border-[var(--color-brand)]">I</button>
        <button type="button" onClick={() => wrapSelection("~~")} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs line-through text-[var(--color-text)] hover:border-[var(--color-brand)]">S</button>
        <button type="button" onClick={insertLink} className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text)] hover:border-[var(--color-brand)]">Link</button>
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById("wizard-richtext") as HTMLTextAreaElement | null;
            const start = el?.selectionStart ?? value.length;
            const next = value.slice(0, start) + "\n- " + value.slice(start);
            onChange(next.slice(0, max));
          }}
          className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text)] hover:border-[var(--color-brand)]"
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className={`ml-auto rounded-md border px-2.5 py-1 text-xs transition ${showPreview ? "border-[var(--color-brand)] text-[var(--color-brand)]" : "border-[var(--color-border)] text-[var(--color-text-secondary)]"}`}
        >
          {showPreview ? "Edit" : "Preview"}
        </button>
      </div>

      {showPreview ? (
        <div
          className={controlCls + " min-h-32 py-2 [&_ul]:my-1 [&_p]:my-1"}
          dangerouslySetInnerHTML={{ __html: mdToHtml(value) || "<p class='text-[var(--color-text-muted)]'>Nothing to preview yet.</p>" }}
        />
      ) : (
        <textarea
          id="wizard-richtext"
          rows={6}
          maxLength={max}
          className={controlCls + " py-2"}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, max))}
          placeholder="Describe the job. Use the buttons above for **bold**, _italic_, ~~strike~~, [links](url), and bullet lists."
        />
      )}
      <p className="text-right text-xs text-[var(--color-text-muted)]">{value.length}/{max}</p>
    </div>
  );
}

/* ───────────────────────── wizard state ───────────────────────── */

type WizardState = {
  // step 1
  name: string;
  job_type: string;
  creator_type: string;
  description: string;
  // step 2
  payment_type: PaymentType;
  fixed_amount: string;
  cpm_rate: string;
  weekly_hours_needed: string;
  hourly_rate: string;
  required_hours: string;
  per_post_amount: string;
  budget: string;
  showAdvancedBudget: boolean;
  // step 3
  bonus_milestones: BonusMilestone[];
  // step 4
  example_videos: string[];
  // step 5
  age_requirement: string;
  platform_focus: string[];
  content_type: string;
  posting_frequency: string;
  video_length: string;
  account_type: string;
  is_app: boolean;
  physical_product: boolean;
  // step 6
  banner_url: string;
  publishNow: boolean;
};

const initialState: WizardState = {
  name: "",
  job_type: "content_creator",
  creator_type: "ugc_ads",
  description: "",
  payment_type: "cpm",
  fixed_amount: "",
  cpm_rate: "",
  weekly_hours_needed: "",
  hourly_rate: "",
  required_hours: "",
  per_post_amount: "",
  budget: "10000",
  showAdvancedBudget: false,
  bonus_milestones: [],
  example_videos: [],
  age_requirement: "any",
  platform_focus: ["tiktok"],
  content_type: "",
  posting_frequency: "",
  video_length: "",
  account_type: "",
  is_app: false,
  physical_product: false,
  banner_url: "",
  publishNow: true,
};

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  // A template only SEEDS the builder — every value it fills stays editable, so
  // the wizard below is identical whether you came from scratch or a template.
  const [template, setTemplate] = useState<CampaignTemplate | undefined>();
  const [f, setF] = useState<WizardState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("template");
    const t = getTemplate(key);
    if (!t) return;
    setTemplate(t);
    setF((cur) => ({ ...cur, ...t.preset }));
  }, []);

  function patch(p: Partial<WizardState>) {
    setF((cur) => ({ ...cur, ...p }));
  }

  /** Drop the template's seeded pay fields, keeping anything already typed. */
  function clearTemplate() {
    if (!template) return;
    const seeded = Object.keys(template.preset) as (keyof WizardState)[];
    const reset = Object.fromEntries(
      seeded.map((k) => [k, initialState[k]]),
    ) as Partial<WizardState>;
    setF((cur) => ({ ...cur, ...reset }));
    setTemplate(undefined);
    window.history.replaceState(null, "", "/admin/campaigns/new");
  }

  function validateStep(n: number): boolean {
    const e: Record<string, string> = {};
    if (n === 1) {
      if (!f.name.trim()) e.name = "Job title is required.";
      if (!f.description.trim()) e.description = "Job description is required.";
    }
    if (n === 2) {
      if (f.payment_type === "fixed" && !f.fixed_amount) e.fixed_amount = "Enter a payment amount.";
      if (f.payment_type === "cpm" && !f.cpm_rate) e.cpm_rate = "Enter a CPM rate.";
      if (f.payment_type === "mixed" && (!f.fixed_amount || !f.cpm_rate)) e.mixed = "Enter both fixed amount and CPM bonus rate.";
      if (f.payment_type === "per_hour" && (!f.hourly_rate || !f.required_hours)) e.per_hour = "Enter hourly rate and required hours.";
      if (f.payment_type === "per_post" && !f.per_post_amount) e.per_post_amount = "Enter a per-post amount.";
    }
    if (n === 5) {
      if (f.platform_focus.length === 0) e.platform_focus = "Pick at least one platform.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(6, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function back() {
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function togglePlatformFocus(p: string) {
    patch({ platform_focus: f.platform_focus.includes(p) ? f.platform_focus.filter((x) => x !== p) : [...f.platform_focus, p] });
  }

  // Compiled markdown brief used as brief_script — satisfies chk_mode_content
  // (mode='create_new' requires a non-empty brief_script).
  const compiledBrief = useMemo(() => {
    const parts = [f.description.trim()];
    if (f.job_type) parts.push(`\n\n**Job type:** ${f.job_type}`);
    if (f.creator_type) parts.push(`**Creator type:** ${f.creator_type}`);
    return parts.filter(Boolean).join("\n");
  }, [f.description, f.job_type, f.creator_type]);

  // Positive cpm_rate/budget are required by DB check constraints regardless
  // of payment_type — apply the documented fallbacks here.
  const effectiveCpmRate = f.payment_type === "cpm" || f.payment_type === "mixed"
    ? Number(f.cpm_rate) || 0.01
    : 0.01;
  const effectiveBudget = Number(f.budget) > 0 ? Number(f.budget) : 10000;

  const save = useMutation({
    mutationFn: async () => {
      const body: CampaignCreate = {
        name: f.name.trim(),
        mode: "create_new",
        cpm_rate: effectiveCpmRate,
        budget: effectiveBudget,
        description: f.description.trim() || undefined,
        brief_script: compiledBrief,
        platforms: f.platform_focus,
        job_type: f.job_type || undefined,
        creator_type: f.creator_type || undefined,
        payment_type: f.payment_type,
        fixed_amount: f.fixed_amount ? Number(f.fixed_amount) : undefined,
        weekly_hours_needed: f.weekly_hours_needed ? Number(f.weekly_hours_needed) : undefined,
        hourly_rate: f.hourly_rate ? Number(f.hourly_rate) : undefined,
        required_hours: f.required_hours ? Number(f.required_hours) : undefined,
        per_post_amount: f.per_post_amount ? Number(f.per_post_amount) : undefined,
        example_videos: f.example_videos.filter(Boolean),
        age_requirement: f.age_requirement || undefined,
        platform_focus: f.platform_focus,
        content_type: f.content_type.trim() || undefined,
        posting_frequency: f.posting_frequency.trim() || undefined,
        video_length: f.video_length.trim() || undefined,
        account_type: f.account_type.trim() || undefined,
        is_app: f.is_app,
        physical_product: f.physical_product,
        banner_url: f.banner_url.trim() || undefined,
        brand_logo_url: f.banner_url.trim() || undefined,
        bonus_milestones: f.bonus_milestones.filter((m) => m.views_threshold > 0),
      };
      const created = await createCampaign(body);
      if (f.publishNow) await publishCampaign(created.id);
      return created;
    },
    onSuccess: () => router.push("/admin/campaigns"),
  });

  return (
    <div className="min-h-[100dvh]">
      <AdminShell />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/admin/campaigns" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
          ← Campaigns
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--color-text)]">New campaign</h1>
        <AdminTabs />

        {template ? (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/10 p-4">
            <span className="rounded-full bg-[var(--color-brand)]/20 px-2.5 py-0.5 text-[10px] font-medium text-[var(--color-brand)]">
              {template.badge}
            </span>
            <p className="min-w-0 flex-1 text-sm text-[var(--color-text-secondary)]">
              Pre-filled from <span className="text-[var(--color-text)]">{template.title}</span>. Every value is
              still editable.
            </p>
            <button
              type="button"
              onClick={clearTemplate}
              className="shrink-0 cursor-pointer text-sm text-[var(--color-text-muted)] underline hover:text-[var(--color-text)]"
            >
              Clear template
            </button>
          </div>
        ) : null}

        {/* step indicator */}
        <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-3">
          {STEPS.map((s, i) => (
            <li key={s.n} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => s.n < step && setStep(s.n)}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition ${
                  s.n === step
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-[var(--color-on-brand)]"
                    : s.n < step
                    ? "border-[var(--color-brand)] text-[var(--color-brand)] cursor-pointer"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                }`}
              >
                {s.n}
              </button>
              <span className={`text-xs font-medium ${s.n === step ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"}`}>{s.label}</span>
              {i < STEPS.length - 1 ? <span className="mx-1 h-px w-4 bg-[var(--color-border)]" /> : null}
            </li>
          ))}
        </ol>

        <div className="card-lumina mt-8 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          {step === 1 ? (
            <div className={sectionCls}>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Job Title &amp; Description</h2>
              <Field id="cf-name" requiredMark error={errors.name} label="Job Title" value={f.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. TikTok UGC Ambassador" />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className={labelCls}>Job Type<span className="ml-0.5 text-[var(--color-danger)]">*</span></label>
                  <select className={controlCls} value={f.job_type} onChange={(e) => patch({ job_type: e.target.value })}>
                    {JOB_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Creator Type<span className="ml-0.5 text-[var(--color-danger)]">*</span></label>
                  <select className={controlCls} value={f.creator_type} onChange={(e) => patch({ creator_type: e.target.value })}>
                    {CREATOR_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelCls}>Job Description<span className="ml-0.5 text-[var(--color-danger)]">*</span></label>
                <RichTextEditor value={f.description} onChange={(v) => patch({ description: v })} />
                {errors.description ? <p className="text-sm text-[var(--color-danger)]">{errors.description}</p> : null}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className={sectionCls}>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Pay &amp; Rates</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {PAYMENT_TYPES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => patch({ payment_type: p.value })}
                    className={`card-lumina rounded-[var(--radius-card)] border p-3 text-left transition ${
                      f.payment_type === p.value
                        ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10"
                        : "border-[var(--color-border)] hover:border-[var(--color-text-muted)]"
                    }`}
                  >
                    <p className="text-sm font-semibold text-[var(--color-text)]">{p.label}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{p.blurb}</p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {f.payment_type === "fixed" ? (
                  <Field requiredMark error={errors.fixed_amount} label="Recurring payment amount ($)" type="number" value={f.fixed_amount} onChange={(e) => patch({ fixed_amount: e.target.value })} />
                ) : null}

                {f.payment_type === "cpm" ? (
                  <>
                    <Field requiredMark error={errors.cpm_rate} label="CPM rate ($ / 1,000 views)" type="number" value={f.cpm_rate} onChange={(e) => patch({ cpm_rate: e.target.value })} />
                    <Field label="Weekly hours needed" type="number" value={f.weekly_hours_needed} onChange={(e) => patch({ weekly_hours_needed: e.target.value })} />
                  </>
                ) : null}

                {f.payment_type === "mixed" ? (
                  <>
                    <Field label="Fixed amount ($)" type="number" value={f.fixed_amount} onChange={(e) => patch({ fixed_amount: e.target.value })} />
                    <Field label="CPM bonus rate ($ / 1,000 views)" type="number" value={f.cpm_rate} onChange={(e) => patch({ cpm_rate: e.target.value })} />
                  </>
                ) : null}

                {f.payment_type === "per_hour" ? (
                  <>
                    <Field label="Hourly rate ($)" type="number" value={f.hourly_rate} onChange={(e) => patch({ hourly_rate: e.target.value })} />
                    <Field label="Required hours" type="number" value={f.required_hours} onChange={(e) => patch({ required_hours: e.target.value })} />
                  </>
                ) : null}

                {f.payment_type === "per_post" ? (
                  <Field requiredMark error={errors.per_post_amount} label="Per-post amount ($)" type="number" value={f.per_post_amount} onChange={(e) => patch({ per_post_amount: e.target.value })} />
                ) : null}
              </div>
              {errors.mixed ? <p className="text-sm text-[var(--color-danger)]">{errors.mixed}</p> : null}
              {errors.per_hour ? <p className="text-sm text-[var(--color-danger)]">{errors.per_hour}</p> : null}

              <div>
                <button type="button" className="text-xs font-medium text-[var(--color-text-secondary)] underline underline-offset-2" onClick={() => patch({ showAdvancedBudget: !f.showAdvancedBudget })}>
                  {f.showAdvancedBudget ? "Hide advanced" : "Advanced: set total campaign budget"}
                </button>
                {f.showAdvancedBudget ? (
                  <div className="mt-3">
                    <Field label="Total campaign budget ($)" type="number" value={f.budget} onChange={(e) => patch({ budget: e.target.value })} />
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">Defaults to $10,000 if left as-is.</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className={sectionCls}>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Bonus Milestones</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Optional. Reward creators for hitting view thresholds.</p>

              <div className="space-y-3">
                {f.bonus_milestones.map((m, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_2fr_auto] items-end gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--color-text-muted)]">Views</label>
                      <input
                        type="number"
                        className={controlCls + " h-9"}
                        value={m.views_threshold || ""}
                        onChange={(e) => {
                          const next = [...f.bonus_milestones];
                          next[i] = { ...next[i], views_threshold: Number(e.target.value) };
                          patch({ bonus_milestones: next });
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--color-text-muted)]">Bonus $</label>
                      <input
                        type="number"
                        className={controlCls + " h-9"}
                        value={m.bonus_amount || ""}
                        onChange={(e) => {
                          const next = [...f.bonus_milestones];
                          next[i] = { ...next[i], bonus_amount: e.target.value };
                          patch({ bonus_milestones: next });
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-[var(--color-text-muted)]">Description</label>
                      <input
                        className={controlCls + " h-9"}
                        value={m.description ?? ""}
                        onChange={(e) => {
                          const next = [...f.bonus_milestones];
                          next[i] = { ...next[i], description: e.target.value };
                          patch({ bonus_milestones: next });
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      aria-label="Remove milestone"
                      onClick={() => patch({ bonus_milestones: f.bonus_milestones.filter((_, idx) => idx !== i) })}
                      className="h-9 rounded-md border border-[var(--color-border)] px-3 text-sm text-[var(--color-danger)] hover:border-[var(--color-danger)]"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => patch({ bonus_milestones: [...f.bonus_milestones, { views_threshold: 0, bonus_amount: "", description: "", sort_order: f.bonus_milestones.length }] })}
                className="rounded-[var(--radius-btn)] border border-dashed border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
              >
                + Add Milestone
              </button>
            </div>
          ) : null}

          {step === 4 ? (
            <div className={sectionCls}>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Example Videos</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Optional. Add up to 3 links to example videos.</p>

              <div className="space-y-3">
                {f.example_videos.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      className={controlCls}
                      value={v}
                      placeholder="https://tiktok.com/@brand/video/..."
                      onChange={(e) => {
                        const next = [...f.example_videos];
                        next[i] = e.target.value;
                        patch({ example_videos: next });
                      }}
                    />
                    <button
                      type="button"
                      aria-label="Remove video"
                      onClick={() => patch({ example_videos: f.example_videos.filter((_, idx) => idx !== i) })}
                      className="h-11 shrink-0 rounded-md border border-[var(--color-border)] px-3 text-sm text-[var(--color-danger)] hover:border-[var(--color-danger)]"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>

              {f.example_videos.length < 3 ? (
                <button
                  type="button"
                  onClick={() => patch({ example_videos: [...f.example_videos, ""] })}
                  className="rounded-[var(--radius-btn)] border border-dashed border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                >
                  + Add Example Video
                </button>
              ) : null}
            </div>
          ) : null}

          {step === 5 ? (
            <div className={sectionCls}>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Applicant Details &amp; Targeting</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className={labelCls}>Age requirement</label>
                  <select className={controlCls} value={f.age_requirement} onChange={(e) => patch({ age_requirement: e.target.value })}>
                    {AGE_REQUIREMENTS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <Field label="Account type" placeholder="Personal Account…" value={f.account_type} onChange={(e) => patch({ account_type: e.target.value })} />
                <Field label="Content type" placeholder="e.g. Talking-head UGC" value={f.content_type} onChange={(e) => patch({ content_type: e.target.value })} />
                <Field label="Posting frequency" placeholder="e.g. 1/day, 30/month" value={f.posting_frequency} onChange={(e) => patch({ posting_frequency: e.target.value })} />
                <Field label="Video length" placeholder="e.g. 30-60 seconds" value={f.video_length} onChange={(e) => patch({ video_length: e.target.value })} />
              </div>

              <div className="space-y-2" id="cf-platform_focus">
                <label className={labelCls}>Platform focus<span className="ml-0.5 text-[var(--color-danger)]">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_FOCUS_OPTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatformFocus(p)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        f.platform_focus.includes(p)
                          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand)]"
                          : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                {errors.platform_focus ? <p className="text-sm text-[var(--color-danger)]">{errors.platform_focus}</p> : null}
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <input type="checkbox" checked={f.is_app} onChange={(e) => patch({ is_app: e.target.checked })} />
                  This promotes an app
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <input type="checkbox" checked={f.physical_product} onChange={(e) => patch({ physical_product: e.target.checked })} />
                  This promotes a physical product
                </label>
              </div>
            </div>
          ) : null}

          {step === 6 ? (
            <div className={sectionCls}>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Job Image &amp; Post</h2>
              <BannerInput value={f.banner_url} onChange={(v) => patch({ banner_url: v })} />

              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">{f.name || "Untitled job"}</p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {f.job_type} · {f.creator_type} · {f.payment_type}
                </p>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <input type="checkbox" checked={f.publishNow} onChange={(e) => patch({ publishNow: e.target.checked })} />
                Publish immediately (visible to creators)
              </label>

              {save.isError ? <p className="text-sm text-[var(--color-danger)]">{(save.error as Error).message}</p> : null}
            </div>
          ) : null}
        </div>

        {/* footer nav */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="w-32">
            {step > 1 ? (
              <button
                type="button"
                onClick={back}
                className="min-h-11 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
              >
                Back
              </button>
            ) : null}
          </div>
          <div className="w-40">
            {step < 6 ? (
              <Button onClick={next}>Next</Button>
            ) : (
              <Button loading={save.isPending} onClick={() => save.mutate()}>Post</Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
