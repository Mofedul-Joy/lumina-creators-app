// Structural shape rather than the creator `Campaign` type, so the admin's
// AdminCampaign (no `joined`, looser numerics) can be matched/themed too.
export type CampaignLike = {
  id?: string;
  slug?: string;
  name?: string | null;
  description?: string | null;
  brand_name?: string | null;
  banner_url?: string | null;
  content_type?: string | null;
  job_type?: string | null;
  creator_type?: string | null;
  platform_focus?: string[] | null;
};

// Niche taxonomy mirrored from the SideShift browse list. Campaigns have no
// niche column, so each niche carries keywords we match against a campaign's
// searchable text — a pragmatic client-side categorisation.
const s = "h-4 w-4";
export type Niche = { key: string; label: string; keywords: string[]; Icon: () => React.ReactElement };

// Rhys 2026-07-23: single category taxonomy across the whole app (Explore
// filters, onboarding industries, admin invite filter). EXACTLY these seven —
// no "Other". Each carries keywords we match against a campaign's searchable
// text for the Explore filters.
export const NICHES: Niche[] = [
  { key: "sports_entertainment", label: "Sports & Entertainment", keywords: ["sport", "sports", "entertainment", "music", "gaming", "game", "film", "movie", "media", "athlete", "team", "event", "concert", "show", "esports"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M12 3a9 9 0 0 0 0 18M3 12h18M12 3c3 2.5 3 15.5 0 18M12 3c-3 2.5-3 15.5 0 18" stroke="currentColor" strokeWidth="1.6" /></svg> },
  { key: "finance_technology", label: "Finance & Technology", keywords: ["finance", "fintech", "tech", "technology", "software", "saas", "ai", "invest", "bank", "money", "startup", "b2b", "trading", "stocks"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><path d="M4 19V9M9 19V5M14 19v-7M19 19v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg> },
  { key: "fashion_beauty", label: "Fashion & Beauty", keywords: ["fashion", "beauty", "makeup", "clothing", "style", "cosmetic", "skincare", "apparel", "jewelry", "hair", "outfit"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><path d="M8 4 5 7l3 2v11h8V9l3-2-3-3-2 2a2 2 0 0 1-4 0L8 4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg> },
  { key: "mobile_apps", label: "Mobile Apps", keywords: ["app", "mobile", "ios", "android", "download", "install", "play store", "app store", "application"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><rect x="7" y="2" width="10" height="20" rx="2.5" stroke="currentColor" strokeWidth="2" /><path d="M11 18h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg> },
  { key: "casino_crypto", label: "Casino & Crypto", keywords: ["casino", "crypto", "slots", "slot", "gambling", "betting", "bet", "bitcoin", "web3", "token", "nft", "poker", "blackjack"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg> },
  { key: "health_wellness", label: "Health & Wellness", keywords: ["health", "wellness", "fitness", "gym", "workout", "supplement", "nutrition", "yoga", "mental", "weight", "diet", "meditation"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.65-7 10-7 10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg> },
  { key: "reaction_content", label: "Reaction Based Content", keywords: ["reaction", "react", "commentary", "review", "response", "reacts", "reacting"],
    Icon: () => <svg className={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M8.5 14c.9 1.2 2.1 2 3.5 2s2.6-.8 3.5-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M9 9.5h.01M15 9.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg> },
];

// Text we search a campaign against for both keyword search and niche matching.
export function campaignText(c: CampaignLike): string {
  return [c.name, c.description, c.brand_name, c.content_type, c.job_type, c.creator_type, ...(c.platform_focus ?? [])]
    .filter(Boolean).join(" ").toLowerCase();
}

export function matchesNiche(c: CampaignLike, nicheKey: string): boolean {
  if (!nicheKey) return true;
  const niche = NICHES.find((n) => n.key === nicheKey);
  if (!niche || niche.keywords.length === 0) return true;
  const text = campaignText(c);
  return niche.keywords.some((k) => text.includes(k));
}

export const nicheLabel = (key: string) => NICHES.find((n) => n.key === key)?.label ?? key;
