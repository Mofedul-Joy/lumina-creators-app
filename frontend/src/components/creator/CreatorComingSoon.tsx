import Link from "next/link";

// Placeholder for creator sections that are in the SideShift-style nav but whose
// features are a later pass (Training, Messages, Affiliates, Account, Pro).
export function CreatorComingSoon({ eyebrow, title, blurb, icon }: { eyebrow: string; title: string; blurb: string; icon: string }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">{eyebrow}</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">{title}</h1>
      <div className="card-lumina mt-8 flex flex-col items-center gap-3 rounded-[var(--radius-card)] px-6 py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-surface-2)] text-2xl">{icon}</span>
        <p className="text-lg font-medium text-[var(--color-text)]">Coming soon</p>
        <p className="max-w-md text-sm text-[var(--color-text-secondary)]">{blurb}</p>
        <Link href="/dashboard" className="mt-3 text-sm text-[var(--color-brand)] hover:underline">← Back to your dashboard</Link>
      </div>
    </main>
  );
}
