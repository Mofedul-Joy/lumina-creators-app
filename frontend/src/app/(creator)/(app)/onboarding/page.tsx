"use client";

import { Suspense } from "react";
import { OnboardingWizard } from "@/components/creator/onboarding/OnboardingWizard";

// The creator onboarding is a progressive, save-as-you-go wizard (see
// OnboardingWizard). It doubles as the "edit profile" surface — the sidebar
// "Profile" link and the dashboard ?step= deep-links land here.
export default function OnboardingPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-xl px-6 py-12 text-sm text-[var(--color-text-secondary)]">Loading…</main>}>
      <OnboardingWizard />
    </Suspense>
  );
}
