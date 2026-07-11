"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { BannerInput } from "@/components/admin/BannerInput";
import { getTemplate, type CampaignTemplate } from "@/lib/campaignTemplates";
import {
  CYCLE_TRIGGERS,
  PAYMENT_SCHEDULES,
  kindLabel,
  scheduleLabel,
  type CampaignKind,
  type ExperienceLevel,
  type PaymentCycleTrigger,
  type PaymentSchedule,
} from "@/lib/campaignFlow";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { fmtInt, fmtMoney } from "@/lib/format";
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
  // flow (chosen in the NewCampaignModal before we get here)
  campaign_kind: CampaignKind;
  experience_level: ExperienceLevel;

  // step 1 — payment type
  payment_type: PaymentType;
  overrideTemplate: boolean;

  // step 2 — campaign details
  name: string;
  job_type: string;
  creator_type: string;
  description: string;
  start_date: string;      // yyyy-mm-dd
  end_date: string;        // "" when ongoing
  ongoing: boolean;

  // step 3 — requirements
  platform_focus: string[];
  no_platform_tracking: boolean;
  payment_schedule: PaymentSchedule;

  // step 4 — compensation
  fixed_amount: string;
  cpm_rate: string;
  weekly_hours_needed: string;
  hourly_rate: string;
  required_hours: string;
  per_post_amount: string;
  posts_per_payment: string;
  min_views: string;
  budget: string;
  showAdvancedBudget: boolean;
  bonus_milestones: BonusMilestone[];

  // step 5 — settings
  payment_cycle_trigger: PaymentCycleTrigger;
  pro_rata: boolean;
  age_requirement: string;
  content_type: string;
  posting_frequency: string;
  video_length: string;
  account_type: string;
  is_app: boolean;
  physical_product: boolean;
  example_videos: string[];
  banner_url: string;
  publishNow: boolean;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const initialState: WizardState = {
  campaign_kind: "high_volume_ugc",
  experience_level: "essentials",
  payment_type: "cpm",
  overrideTemplate: false,
  name: "",
  job_type: "content_creator",
  creator_type: "ugc_ads",
  description: "",
  start_date: todayISO(),
  end_date: "",
  ongoing: true,
  platform_focus: ["tiktok"],
  no_platform_tracking: false,
  payment_schedule: "every_30_days",
  fixed_amount: "",
  cpm_rate: "",
  weekly_hours_needed: "",
  hourly_rate: "",
  required_hours: "",
  per_post_amount: "",
  posts_per_payment: "1",
  min_views: "",
  budget: "10000",
  showAdvancedBudget: false,
  bonus_milestones: [],
  payment_cycle_trigger: "post_delivery",
  pro_rata: true,
  age_requirement: "any",
  content_type: "",
  posting_frequency: "",
  video_length: "",
  account_type: "",
  is_app: false,
  physical_product: false,
  example_videos: [],
  banner_url: "",
  publishNow: true,
};

/* ───────────────────────── small building blocks ───────────────────────── */

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex cursor-pointer items-center gap-2.5"
    >
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          on ? "bg-[var(--color-brand)]" : "bg-[var(--color-surface-2)] ring-1 ring-inset ring-[var(--color-border)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`}
        />
      </span>
      <span className="text-sm text-[var(--color-text)]">{label}</span>
    </button>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2">
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      <span className="text-right text-sm text-[var(--color-text)]">{value}</span>
    </div>
  );
}

function ReviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
      <p className="mb-1 text-sm font-semibold text-[var(--color-text)]">{title}</p>
      <div className="divide-y divide-[var(--color-border)]">{children}</div>
    </div>
  );
}

/* ───────────────────────── the wizard ───────────────────────── */

const STEPS = [
  { n: 1, label: "Payment type" },
  { n: 2, label: "Campaign details" },
  { n: 3, label: "Requirements" },
  { n: 4, label: "Compensation" },
  { n: 5, label: "Settings" },
  { n: 6, label: "Review" },
] as const;

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState<CampaignTemplate | undefined>();
  const [f, setF] = useState<WizardState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  // The chooser modal picked the kind/level (and maybe a template) before
  // routing here. A template only SEEDS the form — every value stays editable.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = getTemplate(q.get("template"));
    const kind = q.get("kind") as CampaignKind | null;
    const level = q.get("level") as ExperienceLevel | null;
    setF((cur) => ({
      ...cur,
      ...(t ? t.preset : {}),
      ...(kind ? { campaign_kind: kind } : {}),
      ...(level ? { experience_level: level } : {}),
    }));
    if (t) setTemplate(t);
  }, []);

  const advanced = f.experience_level === "advanced";

  function patch(p: Partial<WizardState>) {
    setF((cur) => ({ ...cur, ...p }));
  }

  /** Drop the template's seeded pay fields, keeping anything already typed. */
  function clearTemplate() {
    if (!template) return;
    const seeded = Object.keys(template.preset) as (keyof WizardState)[];
    const reset = Object.fromEntries(seeded.map((k) => [k, initialState[k]])) as Partial<WizardState>;
    setF((cur) => ({ ...cur, ...reset, overrideTemplate: false }));
    setTemplate(undefined);
    window.history.replaceState(null, "", "/admin/campaigns/new");
  }

  function validateStep(n: number): boolean {
    const e: Record<string, string> = {};
    if (n === 2) {
      if (!f.name.trim()) e.name = "Campaign name is required.";
      if (!f.description.trim()) e.description = "Description is required.";
      if (!f.start_date) e.start_date = "Pick a start date.";
      if (!f.ongoing && f.end_date && f.end_date <= f.start_date)
        e.end_date = "End date must be after the start date.";
    }
    if (n === 3) {
      // Platforms are how a post is attributed — only skippable when the admin
      // has explicitly turned tracking off.
      if (!f.no_platform_tracking && f.platform_focus.length === 0)
        e.platform_focus = "Pick at least one platform, or turn off platform tracking.";
    }
    if (n === 4) {
      if (f.payment_type === "fixed" && !f.fixed_amount) e.fixed_amount = "Enter a payment amount.";
      if (f.payment_type === "cpm" && !f.cpm_rate) e.cpm_rate = "Enter a CPM rate.";
      if (f.payment_type === "mixed" && (!f.fixed_amount || !f.cpm_rate))
        e.mixed = "Enter both the fixed amount and the CPM bonus rate.";
      if (f.payment_type === "per_hour" && (!f.hourly_rate || !f.required_hours))
        e.per_hour = "Enter the hourly rate and required hours.";
      if (f.payment_type === "per_post" && !f.per_post_amount) e.per_post_amount = "Enter a per-post amount.";
      if (Number(f.posts_per_payment) < 1) e.posts_per_payment = "Must be at least 1.";
      if (f.min_views && Number(f.min_views) < 0) e.min_views = "Cannot be negative.";
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
    patch({
      platform_focus: f.platform_focus.includes(p)
        ? f.platform_focus.filter((x) => x !== p)
        : [...f.platform_focus, p],
    });
  }

  // Compiled markdown brief used as brief_script — satisfies chk_mode_content
  // (mode='create_new' requires a non-empty brief_script).
  const compiledBrief = useMemo(() => {
    const parts = [f.description.trim()];
    if (f.job_type) parts.push(`\n\n**Job type:** ${f.job_type}`);
    if (f.creator_type) parts.push(`**Creator type:** ${f.creator_type}`);
    return parts.filter(Boolean).join("\n");
  }, [f.description, f.job_type, f.creator_type]);

  // Positive cpm_rate/budget are required by DB check constraints regardless of
  // payment_type — apply the documented fallbacks here.
  const effectiveCpmRate =
    f.payment_type === "cpm" || f.payment_type === "mixed" ? Number(f.cpm_rate) || 0.01 : 0.01;
  const effectiveBudget = Number(f.budget) > 0 ? Number(f.budget) : 10000;

  const payLine = (() => {
    switch (f.payment_type) {
      case "fixed":
        return `${fmtMoney(f.fixed_amount || 0)} every ${f.posts_per_payment} post(s)`;
      case "cpm":
        return `${fmtMoney(f.cpm_rate || 0)} / 1,000 views`;
      case "mixed":
        return `${fmtMoney(f.fixed_amount || 0)} + ${fmtMoney(f.cpm_rate || 0)} / 1,000 views`;
      case "per_hour":
        return `${fmtMoney(f.hourly_rate || 0)} / hr · ${f.required_hours || 0} hrs`;
      case "per_post":
        return `${fmtMoney(f.per_post_amount || 0)} / post`;
      default:
        return "—";
    }
  })();

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
        // ---- creation flow (0024) ----
        campaign_kind: f.campaign_kind,
        experience_level: f.experience_level,
        no_platform_tracking: f.no_platform_tracking,
        payment_schedule: f.payment_schedule,
        payment_cycle_trigger: f.payment_cycle_trigger,
        pro_rata: f.pro_rata,
        min_views: f.min_views ? Number(f.min_views) : undefined,
        posts_per_payment: Number(f.posts_per_payment) || 1,
        starts_at: f.start_date ? new Date(f.start_date).toISOString() : undefined,
        // Ongoing == no end date, so there's no second source of truth to disagree.
        ends_at: !f.ongoing && f.end_date ? new Date(f.end_date).toISOString() : undefined,
      };
      const c = await createCampaign(body);
      if (f.publishNow) await publishCampaign(c.id);
      return c;
    },
    onSuccess: (c) => setCreated({ id: c.id, name: c.name }),
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

        {/* stepper */}
        <ol className="mb-2 flex flex-wrap items-center gap-y-2">
          {STEPS.map((s, i) => (
            <li key={s.n} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => s.n < step && setStep(s.n)}
                className={`grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold transition ${
                  s.n === step
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-[var(--color-on-brand)]"
                    : s.n < step
                    ? "cursor-pointer border-[var(--color-brand)] text-[var(--color-brand)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                }`}
              >
                {s.n < step ? "✓" : s.n}
              </button>
              <span className={`text-xs font-medium ${s.n === step ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 ? <span className="mx-1 h-px w-4 bg-[var(--color-border)]" /> : null}
            </li>
          ))}
        </ol>

        {/* kind + level context, so the admin can see what they picked */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
            {kindLabel(f.campaign_kind)}
          </span>
          <span className="rounded-full bg-[var(--color-brand)]/15 px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-brand)]">
            {advanced ? "Advanced" : "Essentials"}
          </span>
        </div>

        <div className="card-lumina mt-6 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          {/* ── step 1: payment type (from template, or overridden) ── */}
          {step === 1 ? (
            <div className={sectionCls}>
              {template && !f.overrideTemplate ? (
                <>
                  <div className="flex flex-wrap items-start gap-3 rounded-xl border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/10 p-4">
                    <span className="rounded-full bg-[var(--color-brand)]/20 px-2.5 py-0.5 text-[10px] font-medium text-[var(--color-brand)]">
                      {template.badge}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--color-text)]">
                        Using template: {template.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{template.example}</p>
                    </div>
                  </div>

                  <h2 className="text-lg font-semibold text-[var(--color-text)]">Payment Structure from Template</h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Your selected template uses the payment structure below. You can override it if needed.
                  </p>

                  <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                    <p className="text-sm font-semibold text-[var(--color-text)]">
                      {PAYMENT_TYPES.find((p) => p.value === f.payment_type)?.label}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                      {PAYMENT_TYPES.find((p) => p.value === f.payment_type)?.blurb}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
                      <p className="text-xs font-medium text-[var(--color-brand)]">✓ Pre-configured from template</p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => patch({ overrideTemplate: true })}
                          className="cursor-pointer rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] transition hover:border-[var(--color-brand)]"
                        >
                          Override template
                        </button>
                        <button
                          type="button"
                          onClick={clearTemplate}
                          className="cursor-pointer text-xs text-[var(--color-text-muted)] underline hover:text-[var(--color-text)]"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-[var(--color-text)]">How would you like to pay creators?</h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Choose the payment structure that works best for this campaign.
                  </p>

                  {template && f.overrideTemplate ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                      <p className="text-sm text-amber-300">
                        <span className="font-semibold">Override mode:</span> you are changing the payment structure
                        from your selected template. The template&apos;s original configuration was{" "}
                        <span className="font-semibold">
                          {PAYMENT_TYPES.find((p) => p.value === template.preset.payment_type)?.label}
                        </span>
                        .
                      </p>
                      <button
                        type="button"
                        onClick={() => patch({ overrideTemplate: false, ...template.preset })}
                        className="mt-3 cursor-pointer rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] transition hover:border-[var(--color-brand)]"
                      >
                        ← Back to template
                      </button>
                    </div>
                  ) : null}

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
                </>
              )}
            </div>
          ) : null}

          {/* ── step 2: campaign details ── */}
          {step === 2 ? (
            <div className={sectionCls}>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Campaign Details</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Set up your campaign&apos;s basic information.</p>

              <Field id="cf-name" requiredMark error={errors.name} label="Campaign name" value={f.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. TikTok UGC Ambassador" />

              {advanced ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className={labelCls}>Job type</label>
                    <select className={controlCls} value={f.job_type} onChange={(e) => patch({ job_type: e.target.value })}>
                      {JOB_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>Creator type</label>
                    <select className={controlCls} value={f.creator_type} onChange={(e) => patch({ creator_type: e.target.value })}>
                      {CREATOR_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className={labelCls}>Description<span className="ml-0.5 text-[var(--color-danger)]">*</span></label>
                <RichTextEditor value={f.description} onChange={(v) => patch({ description: v })} />
                {errors.description ? <p className="text-sm text-[var(--color-danger)]">{errors.description}</p> : null}
              </div>

              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">Campaign duration</p>
                    <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Set start and end dates for your campaign.</p>
                  </div>
                  <Toggle on={f.ongoing} onChange={(v) => patch({ ongoing: v, end_date: v ? "" : f.end_date })} label="Ongoing campaign" />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    id="cf-start"
                    requiredMark
                    error={errors.start_date}
                    label="Start date"
                    type="date"
                    value={f.start_date}
                    onChange={(e) => patch({ start_date: e.target.value })}
                  />
                  {!f.ongoing ? (
                    <Field
                      id="cf-end"
                      error={errors.end_date}
                      label="End date"
                      type="date"
                      value={f.end_date}
                      min={f.start_date}
                      onChange={(e) => patch({ end_date: e.target.value })}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* ── step 3: requirements ── */}
          {step === 3 ? (
            <div className={sectionCls}>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Campaign Requirements</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Define what you expect from creators.</p>

              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  Platforms{!f.no_platform_tracking ? <span className="ml-0.5 text-[var(--color-danger)]">*</span> : null}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                  Select which platforms creators should post on (multiple allowed).
                </p>

                <div className={`mt-3 flex flex-wrap gap-2 ${f.no_platform_tracking ? "pointer-events-none opacity-40" : ""}`}>
                  {PLATFORM_FOCUS_OPTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatformFocus(p)}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm capitalize transition ${
                        f.platform_focus.includes(p)
                          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand)]"
                          : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                {errors.platform_focus ? <p className="mt-2 text-sm text-[var(--color-danger)]">{errors.platform_focus}</p> : null}

                <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                  <Toggle
                    on={f.no_platform_tracking}
                    onChange={(v) => patch({ no_platform_tracking: v })}
                    label="No platform tracking"
                  />
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Pay creators without scraping view counts — for fixed or per-post work where views don&apos;t matter.
                  </p>
                </div>
              </div>

              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">Payment schedule</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Set when creators will receive payments.</p>
                <select
                  className={controlCls + " mt-3"}
                  value={f.payment_schedule}
                  onChange={(e) => patch({ payment_schedule: e.target.value as PaymentSchedule })}
                >
                  {PAYMENT_SCHEDULES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            </div>
          ) : null}

          {/* ── step 4: compensation ── */}
          {step === 4 ? (
            <div className={sectionCls}>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Compensation and Payout</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Define how creators will be compensated.</p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {f.payment_type === "fixed" ? (
                  <>
                    <Field requiredMark error={errors.fixed_amount} label="Recurring payment amount ($)" type="number" value={f.fixed_amount} onChange={(e) => patch({ fixed_amount: e.target.value })} />
                    <Field error={errors.posts_per_payment} label="Paid every N posts" type="number" min="1" value={f.posts_per_payment} onChange={(e) => patch({ posts_per_payment: e.target.value })} />
                  </>
                ) : null}

                {f.payment_type === "cpm" ? (
                  <Field requiredMark error={errors.cpm_rate} label="CPM rate ($ / 1,000 views)" type="number" value={f.cpm_rate} onChange={(e) => patch({ cpm_rate: e.target.value })} />
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

              {/* Minimum views is meaningless when nothing is being tracked. */}
              {!f.no_platform_tracking ? (
                <Field
                  label="Minimum views (optional)"
                  type="number"
                  placeholder="No minimum"
                  error={errors.min_views}
                  value={f.min_views}
                  onChange={(e) => patch({ min_views: e.target.value })}
                />
              ) : null}

              <div>
                <button
                  type="button"
                  className="cursor-pointer text-xs font-medium text-[var(--color-text-secondary)] underline underline-offset-2"
                  onClick={() => patch({ showAdvancedBudget: !f.showAdvancedBudget })}
                >
                  {f.showAdvancedBudget ? "Hide advanced" : "Advanced: set total campaign budget"}
                </button>
                {f.showAdvancedBudget ? (
                  <div className="mt-3">
                    <Field label="Total campaign budget ($)" type="number" value={f.budget} onChange={(e) => patch({ budget: e.target.value })} />
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">Defaults to $10,000 if left as-is.</p>
                  </div>
                ) : null}
              </div>

              {/* Bonus milestones are a power-user feature — Essentials keeps the
                  compensation step to one decision. */}
              {advanced ? (
                <div className="border-t border-[var(--color-border)] pt-5">
                  <p className="text-sm font-semibold text-[var(--color-text)]">Bonus milestones</p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Optional. Reward creators for hitting view thresholds.</p>

                  <div className="mt-3 space-y-3">
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
                          className="h-9 cursor-pointer rounded-md border border-[var(--color-border)] px-3 text-sm text-[var(--color-danger)] hover:border-[var(--color-danger)]"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => patch({ bonus_milestones: [...f.bonus_milestones, { views_threshold: 0, bonus_amount: "", description: "", sort_order: f.bonus_milestones.length }] })}
                    className="mt-3 cursor-pointer rounded-[var(--radius-btn)] border border-dashed border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                  >
                    + Add milestone
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ── step 5: settings ── */}
          {step === 5 ? (
            <div className={sectionCls}>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Settings</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">How payment cycles behave.</p>

              <div className="space-y-2">
                <label className={labelCls}>Payment cycle trigger</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CYCLE_TRIGGERS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => patch({ payment_cycle_trigger: t.key })}
                      className={`cursor-pointer rounded-[var(--radius-card)] border p-3 text-left transition ${
                        f.payment_cycle_trigger === t.key
                          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10"
                          : "border-[var(--color-border)] hover:border-[var(--color-text-muted)]"
                      }`}
                    >
                      <p className="text-sm font-semibold text-[var(--color-text)]">{t.label}</p>
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{t.blurb}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                <Toggle on={f.pro_rata} onChange={(v) => patch({ pro_rata: v })} label="Automatically apply pro rata" />
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Part-way through a cycle, pay the proportion actually delivered rather than the full amount.
                </p>
              </div>

              {advanced ? (
                <div className="space-y-5 border-t border-[var(--color-border)] pt-5">
                  <p className="text-sm font-semibold text-[var(--color-text)]">Targeting &amp; content</p>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className={labelCls}>Age requirement</label>
                      <select className={controlCls} value={f.age_requirement} onChange={(e) => patch({ age_requirement: e.target.value })}>
                        {AGE_REQUIREMENTS.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <Field label="Account type" placeholder="Personal account…" value={f.account_type} onChange={(e) => patch({ account_type: e.target.value })} />
                    <Field label="Content type" placeholder="e.g. Talking-head UGC" value={f.content_type} onChange={(e) => patch({ content_type: e.target.value })} />
                    <Field label="Posting frequency" placeholder="e.g. 1/day, 30/month" value={f.posting_frequency} onChange={(e) => patch({ posting_frequency: e.target.value })} />
                    <Field label="Video length" placeholder="e.g. 30-60 seconds" value={f.video_length} onChange={(e) => patch({ video_length: e.target.value })} />
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

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-[var(--color-text)]">Example videos</p>
                    {f.example_videos.map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          className={controlCls}
                          value={v}
                          placeholder="https://tiktok.com/@brand/video/…"
                          onChange={(e) => {
                            const next = [...f.example_videos];
                            next[i] = e.target.value;
                            patch({ example_videos: next });
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => patch({ example_videos: f.example_videos.filter((_, idx) => idx !== i) })}
                          className="h-11 shrink-0 cursor-pointer rounded-md border border-[var(--color-border)] px-3 text-sm text-[var(--color-danger)] hover:border-[var(--color-danger)]"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {f.example_videos.length < 3 ? (
                      <button
                        type="button"
                        onClick={() => patch({ example_videos: [...f.example_videos, ""] })}
                        className="cursor-pointer rounded-[var(--radius-btn)] border border-dashed border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                      >
                        + Add example video
                      </button>
                    ) : null}
                  </div>

                  <BannerInput value={f.banner_url} onChange={(v) => patch({ banner_url: v })} />
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ── step 6: review ── */}
          {step === 6 ? (
            <div className={sectionCls}>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">Review Your Campaign</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Review all details before creating your campaign.</p>

              <ReviewCard title="Payment type">
                <ReviewRow label="Payment type" value={PAYMENT_TYPES.find((p) => p.value === f.payment_type)?.label} />
                <ReviewRow label="From template" value={template ? (f.overrideTemplate ? `${template.title} (overridden)` : template.title) : "None"} />
              </ReviewCard>

              <ReviewCard title="Basic information">
                <ReviewRow label="Name" value={f.name || "—"} />
                <ReviewRow label="Campaign type" value={kindLabel(f.campaign_kind)} />
                <ReviewRow label="Setup" value={advanced ? "Advanced" : "Essentials"} />
                <ReviewRow
                  label="Duration"
                  value={`${f.start_date || "—"} → ${f.ongoing ? "Ongoing" : f.end_date || "—"}`}
                />
              </ReviewCard>

              <ReviewCard title="Requirements">
                <ReviewRow
                  label="Platforms"
                  value={f.no_platform_tracking ? "No platform tracking" : f.platform_focus.join(", ") || "—"}
                />
                <ReviewRow label="Payment schedule" value={scheduleLabel(f.payment_schedule)} />
              </ReviewCard>

              <ReviewCard title="Compensation">
                <ReviewRow label="Pay" value={payLine} />
                <ReviewRow label="Minimum views" value={f.min_views ? fmtInt(Number(f.min_views)) : "No minimum"} />
                <ReviewRow label="Total budget" value={fmtMoney(effectiveBudget)} />
              </ReviewCard>

              <ReviewCard title="Settings">
                <ReviewRow
                  label="Payment cycle trigger"
                  value={CYCLE_TRIGGERS.find((t) => t.key === f.payment_cycle_trigger)?.label}
                />
                <ReviewRow label="Automatically apply pro rata" value={f.pro_rata ? "Enabled" : "Disabled"} />
              </ReviewCard>

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
                className="min-h-11 w-full cursor-pointer rounded-[var(--radius-btn)] border border-[var(--color-border)] px-4 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
              >
                Back
              </button>
            ) : null}
          </div>
          <div className="w-44">
            {step < 6 ? (
              <Button onClick={next}>Continue</Button>
            ) : (
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Creating…" : "Create campaign"}
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* success modal */}
      {created ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="card-lumina relative w-full max-w-sm rounded-[var(--radius-card)] p-7 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">Campaign created</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[var(--color-text-secondary)]">
              “{created.name}” has been created. What would you like to do next?
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={() => router.push("/admin/creators")}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
              >
                Add creators to campaign
              </button>
              <button
                onClick={() => router.push("/admin/campaigns")}
                className="min-h-11 cursor-pointer rounded-full border border-[var(--color-border)] px-5 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-text-muted)]"
              >
                View all campaigns
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
