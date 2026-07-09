"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * "Complete your profile first" popup — shown when a creator tries to join a
 * campaign before their profile is complete (backend returns 403
 * "profile_incomplete"). Blurred backdrop + a CTA that routes to the profile
 * builder so they can finish and come back.
 */
export function ProfileGateModal({
  open,
  onClose,
  href = "/onboarding",
}: {
  open: boolean;
  onClose: () => void;
  href?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-gate-title"
    >
      {/* blurred backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
      />
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
          Before you can apply to a campaign, add your details — your name and at least
          one social account — so brands know who they&apos;re working with.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={href}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)]"
          >
            Complete Your Profile
          </Link>
          <button
            onClick={onClose}
            className="min-h-11 rounded-full px-5 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)]"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
