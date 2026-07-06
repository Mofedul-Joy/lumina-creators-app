"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuthToken } from "@/lib/auth";
import { LuminaMark } from "@/components/ui/LuminaMark";

// Icons (inline, single-stroke) — kept minimal to match the app's aesthetic.
const ic = "h-[18px] w-[18px]";
const HomeIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><path d="M4 11l8-6 8 6M6 10v9h4v-5h4v5h4v-9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>;
const ExploreIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
const CampaignsIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" stroke="currentColor" strokeWidth="2" /></svg>;
const TrainingIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><path d="M12 4 2 9l10 5 10-5-10-5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M6 11v4c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
const MessageIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><path d="M4 5h16v11H9l-4 4V5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
const AffiliatesIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><path d="M9 12a3 3 0 0 0 4.5.6l3-3A3 3 0 0 0 12.3 5.3l-1.6 1.6M15 12a3 3 0 0 0-4.5-.6l-3 3A3 3 0 0 0 11.7 18.7l1.6-1.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const ProfileIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" /><path d="M4.5 20c1.5-4 5-6 7.5-6s6 2 7.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
const PortfolioIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" /><path d="m10 10 5 3-5 3v-6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
const AccountIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;

const NAV = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/campaigns", label: "Explore", icon: ExploreIcon },
  { href: "/submissions", label: "My Campaigns", icon: CampaignsIcon },
  { href: "/training", label: "Training", icon: TrainingIcon },
  { href: "/messages", label: "Messages", icon: MessageIcon },
  { href: "/affiliates", label: "Affiliates", icon: AffiliatesIcon },
  { href: "/onboarding", label: "Profile", icon: ProfileIcon },
  { href: "/onboarding?step=portfolio", label: "Portfolio", icon: PortfolioIcon },
  { href: "/account", label: "Account", icon: AccountIcon },
] as const;
// A trimmed set for the mobile bottom bar (nine items won't fit).
const MOBILE = new Set(["/dashboard", "/campaigns", "/submissions", "/onboarding", "/account"]);

export function CreatorSidebar() {
  const path = usePathname();
  const router = useRouter();
  // Shortcut items (href with a query, e.g. Portfolio) don't own the active state.
  const isActive = (href: string) => !href.includes("?") && (path === href || path.startsWith(href + "/"));
  const signOut = () => { clearAuthToken(); router.push("/"); };

  return (
    <>
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col bg-[var(--color-bg-deep)]/40 px-4 py-6 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-2">
          <LuminaMark size={28} />
          <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">Lumina Creators</span>
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-0.5 overflow-y-auto no-scrollbar">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={label} href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isActive(href) ? "bg-[var(--color-brand)]/10 font-medium text-[var(--color-brand-soft)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}>
              <Icon />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-4 space-y-3">
          <Link href="/pro" className="card-interactive block rounded-[var(--radius-card)] border border-[var(--color-brand)]/25 bg-gradient-to-br from-[var(--color-brand)]/12 to-[var(--color-bg-deep)] p-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-brand-soft)]">⚡ Upgrade to Pro</span>
            <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">Unlimited applies &amp; priority visibility</span>
          </Link>
          <button onClick={signOut} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]">
            <svg className={ic} viewBox="0 0 24 24" fill="none"><path d="M15 12H4m0 0 3-3m-3 3 3 3M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Log out
          </button>
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-deep)]/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <LuminaMark size={28} />
          <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">Lumina Creators</span>
        </Link>
        <button onClick={signOut} className="cursor-pointer text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Sign out</button>
      </header>

      {/* mobile bottom tabs (trimmed) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-[var(--color-border)] bg-[var(--color-bg-deep)]/90 py-2 backdrop-blur-xl lg:hidden">
        {NAV.filter((n) => MOBILE.has(n.href)).map(({ href, label, icon: Icon }) => (
          <Link key={label} href={href} className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] ${isActive(href) ? "text-[var(--color-brand)]" : "text-[var(--color-text-muted)]"}`}>
            <Icon />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
