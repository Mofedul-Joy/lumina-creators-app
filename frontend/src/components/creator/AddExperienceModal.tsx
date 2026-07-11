"use client";

import { useEffect, useState } from "react";
import { getAuthToken } from "@/lib/auth";
import { addExperience, listRoleTitles, type ExperienceKind, type ExperienceOut } from "@/lib/api";

/**
 * Multi-step "Add experience" popup (Feature 3).
 *
 *   type ─┬─ organic_ugc ──────┐
 *         ├─ ugc_paid_ad ──────┼─► website ─► review ─► done
 *         └─ professional_role ─► role ─────┘
 *
 * Entries are auto-verified on add — there is no manual review step.
 */
const KINDS: { key: ExperienceKind; label: string; blurb: string }[] = [
  { key: "organic_ugc", label: "Organic UGC", blurb: "Content you made for a brand, unpaid or gifted." },
  { key: "ugc_paid_ad", label: "UGC paid ad", blurb: "Content a brand paid to run as an ad." },
  { key: "professional_role", label: "Professional role", blurb: "A job or title you held at a company." },
];

type Step = "type" | "role" | "website" | "review";

export function AddExperienceModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (e: ExperienceOut) => void;
}) {
  const [step, setStep] = useState<Step>("type");
  const [kind, setKind] = useState<ExperienceKind | null>(null);
  const [roleTitle, setRoleTitle] = useState("");
  const [website, setWebsite] = useState("");
  const [roleTitles, setRoleTitles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset to a clean first step every time the popup is reopened.
  useEffect(() => {
    if (!open) return;
    setStep("type");
    setKind(null);
    setRoleTitle("");
    setWebsite("");
    setError(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const token = getAuthToken();
    if (token) listRoleTitles(token).then(setRoleTitles).catch(() => {});
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const kindLabel = KINDS.find((k) => k.key === kind)?.label ?? "";

  function pickKind(k: ExperienceKind) {
    setKind(k);
    setStep(k === "professional_role" ? "role" : "website");
  }

  function back() {
    if (step === "review") setStep("website");
    else if (step === "website") setStep(kind === "professional_role" ? "role" : "type");
    else if (step === "role") setStep("type");
  }

  async function save() {
    const token = getAuthToken();
    if (!token || !kind) return;
    setSaving(true);
    setError(null);
    try {
      const created = await addExperience(token, {
        kind,
        role_title: kind === "professional_role" ? roleTitle : undefined,
        company_url: website.trim(),
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
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" />
      <div className="card-lumina relative w-full max-w-md rounded-[var(--radius-card)] p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 id="add-exp-title" className="text-xl font-semibold text-[var(--color-text)]">
            {step === "type" && "Add experience"}
            {step === "role" && "Pick a job title"}
            {step === "website" && "Company website"}
            {step === "review" && "Review"}
          </h2>
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
          <div className="mt-5 space-y-2.5">
            {KINDS.map((k) => (
              <button
                key={k.key}
                onClick={() => pickKind(k.key)}
                className="w-full cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-left transition hover:border-[var(--color-brand)]"
              >
                <p className="text-sm font-semibold text-[var(--color-text)]">{k.label}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{k.blurb}</p>
              </button>
            ))}
          </div>
        ) : null}

        {/* 2a — job title (professional role only) */}
        {step === "role" ? (
          <div className="mt-5 max-h-[46vh] space-y-2 overflow-y-auto pr-1">
            {roleTitles.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setRoleTitle(t);
                  setStep("website");
                }}
                className={`w-full cursor-pointer rounded-xl border p-3 text-left text-sm transition ${
                  roleTitle === t
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-text)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        ) : null}

        {/* 2b — company website */}
        {step === "website" ? (
          <div className="mt-5">
            <label htmlFor="exp-website" className="text-sm text-[var(--color-text-secondary)]">
              Which company was this for?
            </label>
            <input
              id="exp-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && website.trim()) setStep("review");
              }}
              autoFocus
              placeholder="luminaclippers.com"
              className="mt-2 min-h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
            />
          </div>
        ) : null}

        {/* 3 — review */}
        {step === "review" ? (
          <div className="mt-5">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {kind === "professional_role" ? roleTitle : kindLabel}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{website.trim()}</p>
              {kind === "professional_role" ? (
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{kindLabel}</p>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
              This experience will be automatically verified and visible on your profile.
            </p>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-sm text-[var(--color-danger)]">{error}</p> : null}

        {/* footer */}
        {step !== "type" ? (
          <div className="mt-6 flex items-center gap-2">
            <button
              onClick={back}
              className="min-h-11 cursor-pointer rounded-full px-4 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
            >
              Back
            </button>
            <div className="flex-1" />
            {step === "website" ? (
              <button
                onClick={() => setStep("review")}
                disabled={!website.trim()}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            ) : null}
            {step === "review" ? (
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:opacity-60"
              >
                {saving ? "Adding…" : "Add experience"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
