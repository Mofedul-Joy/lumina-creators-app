"use client";

import { useEffect, useMemo, useState } from "react";
import { getAuthToken } from "@/lib/auth";
import {
  addExperience, listRoleTitles,
  EXPERIENCE_PLATFORMS, EXPERIENCE_DELIVERABLES, EXPERIENCE_NICHES,
  type ExperienceKind, type ExperienceOut,
} from "@/lib/api";
import { Select } from "@/components/ui/Select";

/**
 * "Add experience" popup (Bill's feedback: the old flow captured only a title +
 * a website, which "doesn't feel complete"). Two steps:
 *   1. pick the type of work
 *   2. one details form a creator would actually expect — who it was for, what
 *      they made, on which platforms, results, and a short write-up.
 * Only the brand/client name is required; everything else is optional so the
 * form stays quick to fill. Entries are auto-verified on add.
 */
const KINDS: { key: ExperienceKind; label: string; blurb: string }[] = [
  { key: "organic_ugc", label: "Organic UGC", blurb: "Content you made for a brand, unpaid or gifted." },
  { key: "ugc_paid_ad", label: "UGC paid ad", blurb: "Content a brand paid to run as an ad." },
  { key: "professional_role", label: "Professional role", blurb: "A job or title you held at a company." },
];

type Form = {
  companyName: string;
  roleTitle: string;
  companyUrl: string;
  platforms: string[];
  deliverable: string;
  niche: string;
  period: string;
  workUrl: string;
  results: string;
  description: string;
};

const EMPTY: Form = {
  companyName: "", roleTitle: "", companyUrl: "", platforms: [], deliverable: "",
  niche: "", period: "", workUrl: "", results: "", description: "",
};

const labelCls = "block text-sm font-medium text-[var(--color-text)]";
const helpCls = "mt-0.5 text-xs text-[var(--color-text-muted)]";
const inputCls =
  "mt-1.5 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-brand)]";

export function AddExperienceModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (e: ExperienceOut) => void;
}) {
  const [step, setStep] = useState<"type" | "details">("type");
  const [kind, setKind] = useState<ExperienceKind | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [roleTitles, setRoleTitles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("type");
    setKind(null);
    setForm(EMPTY);
    setError(null);
    const token = getAuthToken();
    if (token) listRoleTitles(token).then(setRoleTitles).catch(() => {});
  }, [open]);

  const kindLabel = useMemo(() => KINDS.find((k) => k.key === kind)?.label ?? "", [kind]);
  const isRole = kind === "professional_role";
  const canSave = form.companyName.trim() !== "" && (!isRole || form.roleTitle !== "");

  if (!open) return null;

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const togglePlatform = (p: string) =>
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p],
    }));

  async function save() {
    const token = getAuthToken();
    if (!token || !kind || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      const created = await addExperience(token, {
        kind,
        role_title: isRole ? form.roleTitle : undefined,
        company_name: form.companyName.trim(),
        company_url: form.companyUrl.trim() || undefined,
        platforms: form.platforms.length ? form.platforms : undefined,
        deliverable: form.deliverable || undefined,
        niche: form.niche || undefined,
        period: form.period.trim() || undefined,
        work_url: form.workUrl.trim() || undefined,
        results: form.results.trim() || undefined,
        description: form.description.trim() || undefined,
      });
      onAdded(created);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add that experience.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="add-exp-title">
      <div aria-hidden className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" />
      <div className="card-lumina relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-[var(--radius-card)]">
        {/* header */}
        <div className="flex items-start justify-between gap-4 px-7 pt-7">
          <div>
            <h2 id="add-exp-title" className="text-xl font-semibold text-[var(--color-text)]">
              {step === "type" ? "Add experience" : "Experience details"}
            </h2>
            {step === "details" ? (
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{kindLabel} · auto-verified when added</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* 1 — type */}
        {step === "type" ? (
          <div className="space-y-2.5 px-7 pb-7 pt-5">
            {KINDS.map((k) => (
              <button
                key={k.key}
                onClick={() => { setKind(k.key); setStep("details"); }}
                className="w-full cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-left transition hover:border-[var(--color-brand)]"
              >
                <p className="text-sm font-semibold text-[var(--color-text)]">{k.label}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{k.blurb}</p>
              </button>
            ))}
          </div>
        ) : null}

        {/* 2 — details form */}
        {step === "details" ? (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-7 py-5">
              {/* brand/client — required */}
              <div>
                <label htmlFor="exp-brand" className={labelCls}>
                  Brand / client name <span className="text-[var(--color-brand)]">*</span>
                </label>
                <input
                  id="exp-brand" autoFocus value={form.companyName}
                  onChange={(e) => set({ companyName: e.target.value })}
                  placeholder="e.g. Glossier"
                  className={inputCls}
                />
                <p className={helpCls}>Who was this work for?</p>
              </div>

              {/* role title — professional role only */}
              {isRole ? (
                <div>
                  <label htmlFor="exp-role" className={labelCls}>
                    Job title <span className="text-[var(--color-brand)]">*</span>
                  </label>
                  <Select
                    id="exp-role" value={form.roleTitle}
                    onChange={(v) => set({ roleTitle: v })}
                    placeholder="Select a title…"
                    className="mt-1.5"
                    options={roleTitles.map((t) => ({ value: t, label: t }))}
                  />
                </div>
              ) : null}

              {/* what you did — the heart of Bill's feedback */}
              <div>
                <label htmlFor="exp-desc" className={labelCls}>What did you do?</label>
                <textarea
                  id="exp-desc" rows={3} value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                  placeholder="Describe the work and the impact — e.g. produced 6 short-form videos that lifted the launch campaign's CTR by 30%."
                  className={`${inputCls} min-h-[84px] resize-y py-2.5 leading-6`}
                />
                <p className={helpCls}>A couple of sentences on the work and its results.</p>
              </div>

              {/* platforms */}
              <div>
                <span className={labelCls}>Platform(s)</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EXPERIENCE_PLATFORMS.map((p) => {
                    const on = form.platforms.includes(p.key);
                    return (
                      <button
                        key={p.key} type="button" onClick={() => togglePlatform(p.key)}
                        className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          on
                            ? "border-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-brand-soft)]"
                            : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand)]"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* deliverable + niche */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="exp-deliverable" className={labelCls}>Deliverable</label>
                  <Select
                    id="exp-deliverable" value={form.deliverable}
                    onChange={(v) => set({ deliverable: v })}
                    placeholder="Select…"
                    className="mt-1.5"
                    options={EXPERIENCE_DELIVERABLES.map((d) => ({ value: d, label: d }))}
                  />
                </div>
                <div>
                  <label htmlFor="exp-niche" className={labelCls}>Niche</label>
                  <Select
                    id="exp-niche" value={form.niche}
                    onChange={(v) => set({ niche: v })}
                    placeholder="Select…"
                    className="mt-1.5"
                    options={EXPERIENCE_NICHES.map((n) => ({ value: n, label: n }))}
                  />
                </div>
              </div>

              {/* period + work link */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="exp-period" className={labelCls}>When</label>
                  <input
                    id="exp-period" value={form.period}
                    onChange={(e) => set({ period: e.target.value })}
                    placeholder="e.g. Jan–Mar 2025"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="exp-work" className={labelCls}>Link to the work</label>
                  <input
                    id="exp-work" value={form.workUrl} inputMode="url"
                    onChange={(e) => set({ workUrl: e.target.value })}
                    placeholder="tiktok.com/@you/video/…"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* results */}
              <div>
                <label htmlFor="exp-results" className={labelCls}>Results / metrics</label>
                <input
                  id="exp-results" value={form.results}
                  onChange={(e) => set({ results: e.target.value })}
                  placeholder="e.g. 1.2M views · 45k likes · 3.4% CTR"
                  className={inputCls}
                />
              </div>

              {/* company website */}
              <div>
                <label htmlFor="exp-site" className={labelCls}>Brand website</label>
                <input
                  id="exp-site" value={form.companyUrl} inputMode="url"
                  onChange={(e) => set({ companyUrl: e.target.value })}
                  placeholder="glossier.com"
                  className={inputCls}
                />
              </div>

              {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
            </div>

            {/* footer */}
            <div className="flex items-center gap-2 border-t border-[var(--color-border)] px-7 py-4">
              <button
                onClick={() => setStep("type")}
                className="min-h-11 cursor-pointer rounded-full px-4 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
              >
                Back
              </button>
              <div className="flex-1" />
              <button
                onClick={save}
                disabled={saving || !canSave}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Adding…" : "Add experience"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
