import Link from "next/link";

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--color-brand)] text-[var(--color-on-brand)]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M8 5v14l11-7L8 5Z" fill="currentColor" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">Lumina Creators</span>
    </Link>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-text-secondary)]">
      {children}
    </span>
  );
}

function BrandButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] shadow-[0_0_30px_-8px_var(--color-brand)] transition hover:bg-[var(--color-brand-hover)] active:translate-y-px"
    >
      {children}
    </Link>
  );
}

function GhostButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--color-border)] px-5 text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-brand)]"
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function AnnouncementBar() {
  return (
    <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-deep)]">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-6 py-2 text-center text-xs text-[var(--color-text-secondary)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
        Already making content? Get paid for it.
        <Link href="/onboarding" className="font-medium text-[var(--color-brand)] hover:underline">
          Start earning →
        </Link>
      </div>
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)]/60 bg-[var(--color-bg)]/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Wordmark />
        <div className="hidden items-center gap-7 text-sm text-[var(--color-text-secondary)] md:flex">
          <a href="#how" className="transition hover:text-[var(--color-text)]">How it works</a>
          <a href="#earn" className="transition hover:text-[var(--color-text)]">Ways to earn</a>
          <a href="#why" className="transition hover:text-[var(--color-text)]">Why Lumina</a>
          <a href="#faq" className="transition hover:text-[var(--color-text)]">FAQ</a>
        </div>
        <div className="flex items-center gap-2">
          <GhostButton href="/login">Sign in</GhostButton>
          <BrandButton href="/onboarding">Start earning</BrandButton>
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-[var(--color-bg-deep)]">
      <div className="glow pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-24 text-center">
        <div className="mb-6 flex justify-center">
          <Pill>
            <span className="text-[var(--color-brand)]">★ 4.9</span> Loved by UGC creators &amp; clippers
          </Pill>
        </div>
        <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight text-[var(--color-text)] sm:text-6xl md:text-7xl">
          The <span className="serif text-[var(--color-brand)]">creator platform</span> for people who want{" "}
          <span className="serif">predictable payouts</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-[var(--color-text-secondary)]">
          Enter Lumina campaigns, post to your own socials, and get paid per 1,000 views. Two ways to earn —
          create original content, or repost approved clips.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <BrandButton href="/onboarding">Start earning</BrandButton>
          <GhostButton href="/login">Sign in</GhostButton>
        </div>
        <p className="mt-5 text-xs text-[var(--color-text-muted)]">
          No following required · Get paid via PayPal, Solana, or Whop
        </p>
      </div>
    </section>
  );
}

function PlatformStrip() {
  const platforms = ["TikTok", "Instagram Reels", "YouTube Shorts", "X", "Facebook"];
  return (
    <section className="border-y border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <p className="mb-5 text-center text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
          Post where your audience already is
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {platforms.map((p) => (
            <span key={p} className="text-lg font-medium text-[var(--color-text-secondary)]">{p}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const items = [
    { k: "Per 1,000 views", v: "CPM payouts", d: "You earn on real, tracked views — not guesses." },
    { k: "5 platforms", v: "One workflow", d: "TikTok, Reels, Shorts, X and Facebook in one place." },
    { k: "Verified only", v: "No bots", d: "Views are scraped and verified before you're paid." },
  ];
  return (
    <section className="bg-[var(--color-bg-deep)]">
      <div className="mx-auto grid max-w-6xl gap-4 px-6 py-16 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.k} className="card-grad rounded-[var(--radius-card)] border border-[var(--color-border)] p-6">
            <p className="text-sm font-medium text-[var(--color-brand)]">{it.k}</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-text)]">{it.v}</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{it.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", t: "Build your profile", d: "Add your socials, follower counts, and a few past videos. Takes a couple of minutes." },
    { n: "02", t: "Enter a campaign", d: "Browse live campaigns, see the CPM and payout, and pick one worth your time." },
    { n: "03", t: "Post & get paid", d: "Publish to your socials, drop the link, and we track the views. Claim your payout." },
  ];
  return (
    <section id="how" className="bg-[var(--color-bg)]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeading eyebrow="How it works" title={<>From sign-up to payout in <span className="serif text-[var(--color-brand)]">three steps</span></>} />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="relative rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-7">
              <span className="serif text-4xl text-[var(--color-brand)]">{s.n}</span>
              <h3 className="mt-3 text-xl font-semibold text-[var(--color-text)]">{s.t}</h3>
              <p className="mt-2 text-[var(--color-text-secondary)]">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WaysToEarn() {
  return (
    <section id="earn" className="bg-[var(--color-bg-deep)]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeading eyebrow="Ways to earn" title={<>Two ways to <span className="serif text-[var(--color-brand)]">get paid</span></>} />
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <div className="card-grad rounded-[var(--radius-card)] border border-[var(--color-border)] p-8">
            <Pill>Higher pay</Pill>
            <h3 className="mt-4 text-2xl font-semibold text-[var(--color-text)]">Create new content</h3>
            <p className="mt-3 text-[var(--color-text-secondary)]">
              Get a short brief or script, film it your way, and post it. Original content earns more — you bring the
              creativity, we bring the campaigns.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li>· Clear scripts and brand rules for every campaign</li>
              <li>· Best for UGC creators who show their face</li>
              <li>· Top CPM rates</li>
            </ul>
          </div>
          <div className="card-grad rounded-[var(--radius-card)] border border-[var(--color-border)] p-8">
            <Pill>Lower effort</Pill>
            <h3 className="mt-4 text-2xl font-semibold text-[var(--color-text)]">Repost approved clips</h3>
            <p className="mt-3 text-[var(--color-text-secondary)]">
              Grab ready-made clips from the campaign folder, post them to your socials, and earn on the views. No
              filming required.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li>· Pre-made, brand-approved clips</li>
              <li>· Best for faceless / clipper accounts</li>
              <li>· Post and earn in minutes</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Why() {
  const values = [
    { t: "Real CPM payouts", d: "You're paid per 1,000 verified views at the campaign's rate — transparent, every time." },
    { t: "Verified views only", d: "Every submission is scraped and checked. No bots, no inflated counts." },
    { t: "Track every view", d: "Watch views, engagement, and estimated earnings update on each of your posts." },
    { t: "Fast, flexible payouts", d: "Cash out via PayPal, Solana, or Whop once your submissions are verified." },
  ];
  return (
    <section id="why" className="bg-[var(--color-bg)]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeading eyebrow="Why Lumina" title={<>Built for creators who want to <span className="serif text-[var(--color-brand)]">actually get paid</span></>} />
        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {values.map((v) => (
            <div key={v.t} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
              <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-brand)]/15 text-[var(--color-brand)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text)]">{v.t}</h3>
              <p className="mt-2 text-[var(--color-text-secondary)]">{v.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const faqs = [
    { q: "How do payouts work?", a: "Every campaign has a CPM rate — an amount paid per 1,000 views. We scrape the views on your posted clip, calculate your earnings, and you claim your payout once it's verified." },
    { q: "Do I need a big following?", a: "No. Campaigns care about views, not follower count. Post consistently and even smaller accounts earn." },
    { q: "What's the difference between the two ways to earn?", a: "Create-new campaigns give you a script to film original content (higher pay). Copy-paste campaigns give you approved clips to repost (lower effort)." },
    { q: "When do I get paid?", a: "After your submission's views are verified and the campaign's retention window is met, you can claim your payout via PayPal, Solana, or Whop." },
    { q: "Which platforms can I post on?", a: "TikTok, Instagram Reels, YouTube Shorts, X, and Facebook — each campaign lists the platforms it accepts." },
  ];
  return (
    <section id="faq" className="bg-[var(--color-bg-deep)]">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <SectionHeading eyebrow="FAQ" title={<>Everything you need to <span className="serif text-[var(--color-brand)]">know</span></>} />
        <div className="mt-12 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {faqs.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-left text-lg font-medium text-[var(--color-text)]">
                {f.q}
                <span className="ml-4 text-[var(--color-text-muted)] transition group-open:rotate-45">＋</span>
              </summary>
              <p className="mt-3 text-[var(--color-text-secondary)]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="relative overflow-hidden bg-[var(--color-bg)]">
      <div className="glow pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-3xl px-6 py-24 text-center">
        <h2 className="text-4xl font-semibold tracking-tight text-[var(--color-text)] sm:text-5xl">
          Start turning posts into <span className="serif text-[var(--color-brand)]">payouts</span>
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[var(--color-text-secondary)]">
          Build your profile in a couple of minutes and enter your first campaign today.
        </p>
        <div className="mt-8 flex justify-center">
          <BrandButton href="/onboarding">Start earning</BrandButton>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-deep)]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div className="max-w-xs">
            <Wordmark />
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              Get paid for the content you already make.
            </p>
          </div>
          <div className="flex gap-14 text-sm">
            <div className="space-y-2">
              <p className="font-medium text-[var(--color-text)]">Product</p>
              <a href="#how" className="block text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">How it works</a>
              <a href="#earn" className="block text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Ways to earn</a>
              <a href="#faq" className="block text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">FAQ</a>
            </div>
            <div className="space-y-2">
              <p className="font-medium text-[var(--color-text)]">Sign in</p>
              <Link href="/login" className="block text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Creator</Link>
              <Link href="/admin/login" className="block text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Admin</Link>
              <Link href="/client/login" className="block text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Client</Link>
            </div>
          </div>
        </div>
        <p className="mt-10 text-xs text-[var(--color-text-muted)]">© {new Date().getFullYear()} Lumina Creators. All rights reserved.</p>
      </div>
    </footer>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: React.ReactNode }) {
  return (
    <div className="text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-[var(--color-brand)]">{eyebrow}</p>
      <h2 className="mx-auto mt-3 max-w-2xl text-balance text-4xl font-semibold tracking-tight text-[var(--color-text)] sm:text-5xl">
        {title}
      </h2>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function Home() {
  return (
    <main className="bg-[var(--color-bg)]">
      <AnnouncementBar />
      <Nav />
      <Hero />
      <PlatformStrip />
      <Stats />
      <HowItWorks />
      <WaysToEarn />
      <Why />
      <Faq />
      <CtaBand />
      <Footer />
    </main>
  );
}
