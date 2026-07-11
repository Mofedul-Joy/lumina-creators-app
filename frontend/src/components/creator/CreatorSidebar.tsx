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
const ProfileIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" /><path d="M4.5 20c1.5-4 5-6 7.5-6s6 2 7.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
const AccountIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3.25" stroke="currentColor" strokeWidth="2" /><path d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const PortfolioIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" /><path d="m10 10 5 3-5 3v-6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
const ContractsIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M14 3v5h5M9 13h6M9 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;

type NavItem = { href: string; label: string; icon: () => React.ReactElement };

// Full SideShift-style creator rail, rendered in the Lumina green/black theme.
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/campaigns", label: "Explore", icon: ExploreIcon },
  { href: "/submissions", label: "My Campaigns", icon: CampaignsIcon },
  { href: "/onboarding", label: "Profile", icon: ProfileIcon },
  { href: "/account", label: "Account", icon: AccountIcon },
  { href: "/portfolio", label: "Portfolio", icon: PortfolioIcon },
  { href: "/contracts", label: "Agreements", icon: ContractsIcon },
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
    <div className="mt-4">
      <button onClick={signOut} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]">
        <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none"><path d="M15 12H4m0 0 3-3m-3 3 3 3M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Log out
      </button>
    </div>
  );
}

// Persistent rail on desktop; an off-canvas drawer (controlled by the top bar
// hamburger) on mobile.
export function CreatorSidebar({ mobileOpen, deskOpen, onClose }: { mobileOpen: boolean; deskOpen: boolean; onClose: () => void }) {
  return (
    <>
      {/* desktop: collapsible left rail (toggled from the top bar) */}
      <aside className={`sticky top-0 hidden h-[100dvh] shrink-0 flex-col overflow-hidden bg-[var(--color-bg-deep)]/40 transition-all duration-200 ease-out lg:flex ${
        deskOpen ? "w-60 border-r border-[var(--color-border)]/60 px-4 py-6 opacity-100" : "pointer-events-none w-0 border-0 px-0 py-6 opacity-0"
      }`}>
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
      <div aria-hidden onClick={onClose} className={`fixed inset-0 z-40 bg-black/55 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[260px] flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-deep)] px-4 py-6 shadow-2xl transition-transform duration-200 ease-out lg:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
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
