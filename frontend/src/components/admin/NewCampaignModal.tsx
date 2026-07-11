"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CAMPAIGN_TEMPLATES, type CampaignTemplateKey } from "@/lib/campaignTemplates";

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

export function NewCampaignModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowTemplates(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const goScratch = () => router.push("/admin/campaigns/new");
  const goTemplate = (key: CampaignTemplateKey) =>
    router.push(`/admin/campaigns/new?template=${key}`);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="new-campaign-title">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" />
      <div className="card-lumina relative my-auto w-full max-w-2xl rounded-[var(--radius-card)] p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="new-campaign-title" className="text-xl font-semibold text-[var(--color-text)]">
              Create a New Campaign
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Choose how you want to create your campaign
            </p>
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

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <button
            onClick={goScratch}
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
                  onClick={() => goTemplate(t.key)}
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
      </div>
    </div>
  );
}
