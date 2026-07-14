"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CAMPAIGN_TEMPLATES, type CampaignTemplateKey } from "@/lib/campaignTemplates";
import {
  CAMPAIGN_KINDS,
  EXPERIENCE_LEVELS,
  type CampaignKind,
  type ExperienceLevel,
} from "@/lib/campaignFlow";

/**
 * "Create a New Campaign" chooser.
 *
 * Start from Scratch → the builder with its defaults.
 * Use a Template    → reveals the template grid; picking one opens the SAME
 *                     builder pre-filled (?template=…). Nothing is locked —
 *                     every seeded value stays editable.
 */
function ScratchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="8" y="3" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Three stages, one popup:
 *   start  → Start from Scratch | Use a Template (+ the template grid)
 *   kind   → what KIND of campaign this is
 *   level  → how much setup the admin wants (Essentials vs Advanced)
 * Then it opens the builder with everything chosen so far in the query string.
 */
type Stage = "start" | "kind" | "level";

export function NewCampaignModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [showTemplates, setShowTemplates] = useState(false);
  const [stage, setStage] = useState<Stage>("start");
  const [template, setTemplate] = useState<CampaignTemplateKey | null>(null);
  const [kind, setKind] = useState<CampaignKind | null>(null);

  useEffect(() => {
    if (!open) return;
    setShowTemplates(false);
    setStage("start");
    setTemplate(null);
    setKind(null);
  }, [open]);

  if (!open) return null;

  function start(t: CampaignTemplateKey | null) {
    setTemplate(t);
    setStage("kind");
  }

  function chooseKind(k: CampaignKind) {
    setKind(k);
    // Analytics-only launches no creator program, so there's nothing to set up
    // and no experience level to ask about.
    if (k === "analytics_only") return finish(k, "essentials");
    setStage("level");
  }

  function finish(k: CampaignKind, level: ExperienceLevel) {
    const qs = new URLSearchParams({ kind: k, level });
    if (template) qs.set("template", template);
    router.push(`/admin/campaigns/new?${qs.toString()}`);
  }

  const back = () => setStage(stage === "level" ? "kind" : "start");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="new-campaign-title">
      <div aria-hidden className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" />
      <div className="card-lumina relative my-auto w-full max-w-2xl rounded-[var(--radius-card)] p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {stage !== "start" ? (
              <button
                onClick={back}
                aria-label="Back"
                className="mt-0.5 grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-text)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}
            <div>
              <h2 id="new-campaign-title" className="text-xl font-semibold text-[var(--color-text)]">
                {stage === "level"
                  ? "What's your experience running a UGC campaign?"
                  : "Create a New Campaign"}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {stage === "start" && "Choose how you want to create your campaign"}
                {stage === "kind" && "Choose how creators will produce content and how payments will be structured"}
                {stage === "level" && "We'll customize your setup based on your answer"}
              </p>
            </div>
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

        {/* ── stage: campaign kind ── */}
        {stage === "kind" ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {CAMPAIGN_KINDS.map((k) => (
              <button
                key={k.key}
                onClick={() => chooseKind(k.key)}
                className="cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 text-left transition hover:border-[var(--color-brand)]"
              >
                <p className="text-sm font-semibold text-[var(--color-text)]">{k.title}</p>
                <p className="mt-1.5 text-xs leading-5 text-[var(--color-text-secondary)]">{k.blurb}</p>
              </button>
            ))}
          </div>
        ) : null}

        {/* ── stage: experience level ── */}
        {stage === "level" && kind ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {EXPERIENCE_LEVELS.map((l) => (
              <button
                key={l.key}
                onClick={() => finish(kind, l.key)}
                className="cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 text-left transition hover:border-[var(--color-brand)]"
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[var(--color-text)]">{l.title}</p>
                  {l.recommended ? (
                    <span className="rounded-full bg-[var(--color-brand)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--color-brand)]">
                      Recommended
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-xs leading-5 text-[var(--color-text-secondary)]">{l.blurb}</p>
              </button>
            ))}
          </div>
        ) : null}

        {stage !== "start" ? null : (
        <>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => start(null)}
            className="cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 text-left transition hover:border-[var(--color-brand)]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
              <ScratchIcon />
            </span>
            <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">Start from Scratch</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Create a new campaign with custom settings.
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
              Build your campaign from the ground up with your preferred payment structure and requirements.
            </p>
          </button>

          <button
            onClick={() => setShowTemplates((v) => !v)}
            aria-expanded={showTemplates}
            className={`cursor-pointer rounded-xl border p-5 text-left transition ${
              showTemplates
                ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10"
                : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-brand)]"
            }`}
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
              <TemplateIcon />
            </span>
            <p className="mt-3 text-sm font-semibold text-[var(--color-text)]">Use a Template</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Start with a pre-configured template.
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
              Save time by using an existing template with predefined settings and requirements.
            </p>
          </button>
        </div>

        {showTemplates ? (
          <>
            <p className="mt-6 text-sm font-semibold text-[var(--color-text)]">Available Templates</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {CAMPAIGN_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => start(t.key)}
                  className="cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-left transition hover:border-[var(--color-brand)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--color-text)]">{t.title}</p>
                    <span className="shrink-0 rounded-full bg-[var(--color-brand)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--color-brand)]">
                      {t.badge}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">{t.blurb}</p>
                  <p className="mt-1.5 text-xs leading-5 text-[var(--color-text-muted)]">{t.example}</p>
                </button>
              ))}
            </div>
          </>
        ) : null}
        </>
        )}
      </div>
    </div>
  );
}
