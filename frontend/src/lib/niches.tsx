import type { Campaign } from "@/lib/campaigns";

// Niche taxonomy mirrored from the SideShift browse list. Campaigns have no
// niche column, so each niche carries keywords we match against a campaign's
// searchable text — a pragmatic client-side categorisation.
const s = "h-4 w-4";
export type Niche = { key: string; label: string; keywords: string[]; Icon: () => React.ReactElement };

export const NICHES: Niche[] = [
  { key: "social", label: "Social & Communication", keywords: ["social", "community", "communication", "creator", "influenc"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="2" /><path d="M2 20c1-3 3.5-4 6-4s5 1 6 4M17 8a3 3 0 0 1 0 6M19 20c-.4-1.5-1.2-2.6-2.4-3.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg> },
  { key: "finance", label: "Finance & Commerce", keywords: ["finance", "fintech", "crypto", "money", "commerce", "ecommerce", "shop", "bank", "invest"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><path d="M4 7h16v11H4zM4 10h16M8 14h4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg> },
  { key: "entertainment", label: "Entertainment & Media", keywords: ["entertainment", "media", "music", "gaming", "game", "film", "movie", "podcast"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><path d="M9 18V6l10-2v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2" /><circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="2" /></svg> },
  { key: "health", label: "Health & Fitness", keywords: ["health", "fitness", "wellness", "gym", "workout", "supplement", "nutrition", "yoga"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><path d="M6 9v6M18 9v6M4 11v2M20 11v2M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg> },
  { key: "education", label: "Education & Learning", keywords: ["education", "learning", "course", "tutorial", "teach", "study", "school", "student"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><path d="M12 4 2 9l10 5 10-5-10-5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M6 11v4c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg> },
  { key: "travel", label: "Travel & Local", keywords: ["travel", "local", "tourism", "hotel", "resort", "trip", "vacation"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><path d="M12 21s6-5.5 6-10a6 6 0 1 0-12 0c0 4.5 6 10 6 10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="2" /></svg> },
  { key: "lifestyle", label: "Lifestyle & Utilities", keywords: ["lifestyle", "utilities", "app", "productivity", "tool", "saas"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" /></svg> },
  { key: "photo", label: "Photo & Video", keywords: ["photo", "video", "camera", "film", "footage", "editing"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="2" /><path d="m17 11 4-2v6l-4-2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg> },
  { key: "food", label: "Food & Drink", keywords: ["food", "drink", "beverage", "restaurant", "recipe", "coffee", "snack", "meal"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><path d="M6 3v7a2 2 0 0 0 4 0V3M8 3v18M17 3c-2 0-3 2-3 5s1 4 3 4v9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  { key: "home", label: "Home & Family", keywords: ["home", "family", "kids", "parent", "decor", "furniture", "baby"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><path d="M4 11l8-6 8 6M6 10v9h12v-9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg> },
  { key: "fashion", label: "Fashion & Beauty", keywords: ["fashion", "beauty", "makeup", "clothing", "style", "cosmetic", "skincare", "apparel"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><path d="M8 4 5 7l3 2v11h8V9l3-2-3-3-2 2a2 2 0 0 1-4 0L8 4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg> },
  { key: "other", label: "Other", keywords: [],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" /></svg> },
];

// Text we search a campaign against for both keyword search and niche matching.
export function campaignText(c: Campaign): string {
  return [c.name, c.description, c.brand_name, c.content_type, c.job_type, c.creator_type, ...(c.platform_focus ?? [])]
    .filter(Boolean).join(" ").toLowerCase();
}

export function matchesNiche(c: Campaign, nicheKey: string): boolean {
  if (!nicheKey) return true;
  const text = campaignText(c);
  // "Other" = uncategorised: a campaign that matches none of the keyworded niches.
  if (nicheKey === "other") {
    return !NICHES.some((n) => n.keywords.length > 0 && n.keywords.some((k) => text.includes(k)));
  }
  const niche = NICHES.find((n) => n.key === nicheKey);
  if (!niche || niche.keywords.length === 0) return true;
  return niche.keywords.some((k) => text.includes(k));
}

export const nicheLabel = (key: string) => NICHES.find((n) => n.key === key)?.label ?? key;
