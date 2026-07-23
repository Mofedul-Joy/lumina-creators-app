import Link from "next/link";
import { LuminaMark } from "@/components/ui/LuminaMark";

function Wordmark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <LuminaMark size={28} />
      <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">Lumina Creators</span>
    </Link>
  );
}

// Rhys 2026-07-23: value props on the sign-up/sign-in card.
const POINTS = [
  "Get paid per 1000 views",
  "Get paid per video created",
  "Instant payouts via Paypal, Crypto & many options",
];

export function AuthCard({
  title,
  subtitle,
  children,
  hideMarketing = false,
  eyebrow = "Lumina Creators",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  // Admin + client sign-in have no business showing the creator "get paid to
  // post" pitch — they opt out and get a plain centered form instead.
  hideMarketing?: boolean;
  eyebrow?: string;
}) {
  if (hideMarketing) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-6 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-10"><Wordmark /></div>
          <p className="mb-2 text-sm font-medium text-[var(--color-brand)]">{eyebrow}</p>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{subtitle}</p> : null}
          <div className="mt-7">{children}</div>
        </div>
      </main>
    );
  }
  return (
    <main className="flex min-h-[100dvh]">
      {/* Brand panel — transparent so the global green grid runs continuously
          across both halves; only adds brand glow + ring on top. */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-[var(--color-border)] p-10 lg:flex">
        <div className="glow-hero pointer-events-none absolute inset-0 opacity-90" />
        {/* neon horizon ring */}
        <div
          className="pointer-events-none absolute left-1/2 top-[42%] h-[520px] w-[520px] -translate-x-1/2 rounded-full border border-[var(--color-brand)]/25"
          style={{ boxShadow: "0 0 120px -20px rgba(34,197,94,0.45), inset 0 0 80px -30px rgba(125,255,166,0.4)" }}
        />
        <div className="relative">
          <Wordmark />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight text-[var(--color-text)]">
            Get paid to <span className="serif text-[var(--color-brand)]">post</span>.
          </h2>
          <p className="mt-4 text-[var(--color-text-secondary)]">
            Post on your own socials or create content with no posting required. Earn money instantly.
          </p>
          <ul className="mt-8 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-[var(--color-text-muted)]">Trusted by UGC creators &amp; clippers</p>
      </aside>

      {/* Form panel */}
      <section className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 lg:hidden">
            <Wordmark />
          </div>
          <p className="mb-2 text-sm font-medium text-[var(--color-brand)]">Lumina Creators</p>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{subtitle}</p>
          ) : null}
          <div className="mt-7">{children}</div>
        </div>
      </section>
    </main>
  );
}
