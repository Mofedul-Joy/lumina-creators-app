import Link from "next/link";

function Wordmark() {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-brand)] text-[var(--color-on-brand)]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M8 5v14l11-7L8 5Z" fill="currentColor" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">Lumina Creators</span>
    </Link>
  );
}

const POINTS = [
  "Get paid per 1,000 views",
  "Verified views only — no bots",
  "Cash out via PayPal, Solana, or Whop",
];

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
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
            Enter Lumina campaigns, post to your own socials, and earn on every verified view.
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
