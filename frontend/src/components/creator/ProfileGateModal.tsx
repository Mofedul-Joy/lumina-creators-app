"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuthToken } from "@/lib/auth";
import { getCompletion, type ProfileSection } from "@/lib/api";

/**
 * "Complete your profile first" popup — shown when a creator tries to join a
 * campaign before their whole profile is done (backend 403 "profile_incomplete").
 * It fetches which section they still need and routes the CTA straight there, so
 * they pick up where they left off.
 */
const SECTION_LABEL: Record<ProfileSection, string> = {
  about: "About you",
  socials: "Socials",
  videos: "Videos",
  details: "Details",
  payment: "Payment",
};
// section → onboarding ?step= alias (resolveInitialStep understands these)
const SECTION_STEP: Record<ProfileSection, string> = {
  about: "type",       // creator-type step gates the "about" requirement
  socials: "socials",
  videos: "portfolio",
  details: "details",
  payment: "payment",
};
const ORDER: ProfileSection[] = ["about", "socials", "videos", "details"];

export function ProfileGateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [next, setNext] = useState<ProfileSection | null>(null);
  const [sections, setSections] = useState<Partial<Record<ProfileSection, boolean>>>({});

  useEffect(() => {
    if (!open) return;
    const token = getAuthToken();
    if (token) {
      getCompletion(token)
        .then((c) => { setNext(c.next_section); setSections(c.sections ?? {}); })
        .catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  const step = next ? SECTION_STEP[next] : "";
  const href = step ? `/onboarding?step=${step}` : "/onboarding";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="profile-gate-title">
      <div aria-hidden className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" />
      <div className="card-lumina relative w-full max-w-md rounded-[var(--radius-card)] p-7 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <h2 id="profile-gate-title" className="text-xl font-semibold text-[var(--color-text)]">
          Complete your profile first
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--color-text-secondary)]">
          Finish your profile (About, Socials and Videos) before you can join a campaign.
          We&apos;ll take you straight to the part you still need.
        </p>

        {/* section checklist so they see what's left */}
        {ORDER.some((s) => s in sections) ? (
          <ul className="mx-auto mt-5 max-w-xs space-y-1.5 text-left">
            {ORDER.map((s) => {
              const done = !!sections[s];
              const isNext = s === next;
              return (
                <li key={s} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${done ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "border border-[var(--color-border)] text-[var(--color-text-muted)]"}`}
                  >
                    {done ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : null}
                  </span>
                  <span className={done ? "text-[var(--color-text-secondary)]" : isNext ? "font-medium text-[var(--color-text)]" : "text-[var(--color-text-muted)]"}>
                    {SECTION_LABEL[s]}{isNext ? " — up next" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={href}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
          >
            {next ? `Complete Your Profile — ${SECTION_LABEL[next]}` : "Complete Your Profile"}
          </Link>
          <button onClick={onClose} className="min-h-11 rounded-full px-5 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
