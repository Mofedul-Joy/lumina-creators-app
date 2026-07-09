"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuthToken } from "@/lib/auth";
import { LuminaMark } from "@/components/ui/LuminaMark";

// Icons (inline, single-stroke) — minimal, to match the app's aesthetic.
const ic = "h-[20px] w-[20px] shrink-0";
const CampaignsIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" stroke="currentColor" strokeWidth="2" /></svg>;
const SubmissionsIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" /><path d="m10 9 5 3-5 3V9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
const ProfileIcon = () => <svg className={ic} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" /><path d="M4.5 20c1.5-4 5-6 7.5-6s6 2 7.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;

// The creator app has exactly three functions, per product direction:
// Campaigns (browse & join) · My submissions (posts, views & earnings) · Profile.
const NAV = [
  { href: "/campaigns", label: "Campaigns", desc: "Browse & join campaigns", icon: CampaignsIcon },
  { href: "/submissions", label: "My submissions", desc: "Posts, views & earnings", icon: SubmissionsIcon },
  { href: "/onboarding", label: "Profile", desc: "Build & edit your profile", icon: ProfileIcon },
] as const;

// Controlled left drawer, opened from the hamburger in CreatorLayout — the
// SideShift-style off-canvas rail, rendered in the Lumina green/black theme.
export function CreatorSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  const router = useRouter();
  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  const signOut = () => { clearAuthToken(); onClose(); router.push("/"); };

  return (
    <>
      {/* backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/55 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      {/* off-canvas drawer */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[264px] flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-deep)] px-4 py-5 shadow-2xl transition-transform duration-200 ease-out ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-1">
          <Link href="/campaigns" onClick={onClose} className="flex items-center gap-2">
            <LuminaMark size={28} />
            <span className="text-[15px] font-semibold tracking-tight text-[var(--color-text)]">Lumina Creators</span>
          </Link>
          <button onClick={onClose} aria-label="Close menu" className="cursor-pointer rounded-lg p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        <nav className="mt-7 flex flex-1 flex-col gap-1.5">
          {NAV.map(({ href, label, desc, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                isActive(href)
                  ? "bg-[var(--color-brand)]/12 text-[var(--color-brand-soft)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]/60 hover:text-[var(--color-text)]"
              }`}
            >
              <Icon />
              <span className="flex flex-col">
                <span className={`font-medium ${isActive(href) ? "text-[var(--color-brand-soft)]" : "text-[var(--color-text)]"}`}>{label}</span>
                <span className="text-xs text-[var(--color-text-muted)]">{desc}</span>
              </span>
            </Link>
          ))}
        </nav>

        <button onClick={signOut} className="mt-4 flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface)]/60 hover:text-[var(--color-text)]">
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none"><path d="M15 12H4m0 0 3-3m-3 3 3 3M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Log out
        </button>
      </aside>
    </>
  );
}
