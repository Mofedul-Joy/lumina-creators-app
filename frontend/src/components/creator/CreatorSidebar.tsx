"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuthToken } from "@/lib/auth";
import { LuminaMark } from "@/components/ui/LuminaMark";

// Icons (inline, single-stroke) — minimal, to match the app's aesthetic.
const ic = "h-[19px] w-[19px] shrink-0";
const HomeIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><path d="M4 11l8-6 8 6M6 10v9h4v-5h4v5h4v-9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>;
const ExploreIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
const CampaignsIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" stroke="currentColor" strokeWidth="2" /></svg>;
const TrainingIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><path d="M12 4 2 9l10 5 10-5-10-5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M6 11v4c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
const MessageIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><path d="M4 5h16v11H9l-4 4V5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
const AffiliatesIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><path d="M9 12a3 3 0 0 0 4.5.6l3-3A3 3 0 0 0 12.3 5.3l-1.6 1.6M15 12a3 3 0 0 0-4.5-.6l-3 3A3 3 0 0 0 11.7 18.7l1.6-1.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const ProfileIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" /><path d="M4.5 20c1.5-4 5-6 7.5-6s6 2 7.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
const AccountIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
const PortfolioIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" /><path d="m10 10 5 3-5 3v-6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;

type NavItem = { href: string; label: string; icon: () => React.ReactElement };

// Full SideShift-style creator rail, rendered in the Lumina green/black theme.
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/campaigns", label: "Explore", icon: ExploreIcon },
  { href: "/submissions", label: "My Campaigns", icon: CampaignsIcon },
  { href: "/training", label: "Training", icon: TrainingIcon },
  { href: "/messages", label: "Messages", icon: MessageIcon },
  { href: "/affiliates", label: "Affiliates", icon: AffiliatesIcon },
  { href: "/onboarding", label: "Profile", icon: ProfileIcon },
  { href: "/account", label: "Account", icon: AccountIcon },
  { href: "/onboarding?tab=portfolio", label: "Portfolio", icon: PortfolioIcon },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const isActive = (href: string) => !href.includes("?") && (path === href || path.startsWith(href + "/"));
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto no-scrollbar">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={label}
          href={href}
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
            isActive(href)
              ? "bg-[var(--color-brand)]/12 font-medium text-[var(--color-brand-soft)]"
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]/60 hover:text-[var(--color-text)]"
          }`}
        >
          <Icon />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function Footer({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const signOut = () => { clearAuthToken(); onNavigate?.(); router.push("/"); };
  return (
    <div className="mt-4 space-y-3">
      <Link href="/pro" onClick={onNavigate} className="card-interactive block rounded-[var(--radius-card)] border border-[var(--color-brand)]/25 bg-gradient-to-br from-[var(--color-brand)]/12 to-[var(--color-bg-deep)] p-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-brand-soft)]">⚡ Upgrade to Pro</span>
        <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">Unlimited applies &amp; priority visibility</span>
      </Link>
      <button onClick={signOut} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]">
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none"><path d="M15 12H4m0 0 3-3m-3 3 3 3M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Log out
      </button>
    </div>
  );
}

// Persistent rail on desktop; an off-canvas drawer (controlled by the top bar
// hamburger) on mobile.
export function CreatorSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {/* desktop: persistent left rail */}
      <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col border-r border-[var(--color-border)]/60 bg-[var(--color-bg-deep)]/40 px-4 py-6 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-2">
          <LuminaMark size={28} />
          <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">Lumina Creators</span>
        </Link>
        <div className="mt-7 flex flex-1 flex-col">
          <NavList />
          <Footer />
        </div>
      </aside>

      {/* mobile: backdrop + off-canvas drawer */}
      <div aria-hidden onClick={onClose} className={`fixed inset-0 z-40 bg-black/55 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[260px] flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-deep)] px-4 py-6 shadow-2xl transition-transform duration-200 ease-out lg:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-1">
          <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2">
            <LuminaMark size={28} />
            <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">Lumina Creators</span>
          </Link>
          <button onClick={onClose} aria-label="Close menu" className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="mt-6 flex flex-1 flex-col">
          <NavList onNavigate={onClose} />
          <Footer onNavigate={onClose} />
        </div>
      </aside>
    </>
  );
}
