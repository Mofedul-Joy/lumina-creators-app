import type { Campaign } from "@/lib/campaigns";
import { fmtMoney } from "@/lib/format";
import { NICHES, matchesNiche } from "@/lib/niches";

// Curated, niche-relevant stock photos (Unsplash, hotlink-stable, all verified
// 200) so a campaign without an uploaded banner still gets a real, on-topic
// thumbnail instead of a plain wordmark. Keyed by niche.
const U = (id: string) => `https://images.unsplash.com/${id}?w=800&q=70&auto=format&fit=crop`;
const NICHE_IMAGE: Record<string, string> = {
  health: U("photo-1571019613454-1cb2f99b2d8b"),
  food: U("photo-1504674900247-0877df9cc836"),
  fashion: U("photo-1445205170230-053b83016050"),
  social: U("photo-1522071820081-009f0129c71c"),
  finance: U("photo-1460925895917-afdab827c52f"),
  entertainment: U("photo-1492684223066-81342ee5ff30"),
  education: U("photo-1522202176988-66273c2fd55f"),
  travel: U("photo-1476514525535-07fb3b4ae5f1"),
  lifestyle: U("photo-1493711662062-fa541adb3fc8"),
  home: U("photo-1600880292203-757bb62b4baf"),
  photo: U("photo-1526374965328-7f61d4dc18c5"),
};
const DEFAULT_IMAGE = U("photo-1533488765986-dfa2a9939acd"); // content-creation desk

// The image to show for a campaign: uploaded banner if any, else a niche-matched
// stock photo (first niche whose keywords match), else a generic UGC image.
export function campaignImage(c: Campaign): string {
  if (c.banner_url) return c.banner_url;
  const hit = NICHES.find((n) => n.keywords.length > 0 && matchesNiche(c, n.key));
  return (hit && NICHE_IMAGE[hit.key]) || DEFAULT_IMAGE;
}

// Rich, Lumina-flavoured banner gradients used as a fallback thumbnail when a
// campaign has no uploaded banner — so the grid looks as premium as SideShift's
// even before brands add artwork. Deterministic per campaign so a card keeps the
// same look across renders.
const GRADIENTS: { bg: string; fg: string }[] = [
  { bg: "linear-gradient(135deg,#052e1a 0%,#0b7a43 100%)", fg: "#d1fae5" },
  { bg: "linear-gradient(135deg,#064e3b 0%,#10b981 100%)", fg: "#ecfdf5" },
  { bg: "linear-gradient(135deg,#0f2027 0%,#2c9d5f 100%)", fg: "#eafff3" },
  { bg: "linear-gradient(135deg,#134e4a 0%,#2dd4bf 100%)", fg: "#042f2e" },
  { bg: "linear-gradient(135deg,#1a2e05 0%,#65a30d 100%)", fg: "#f7fee7" },
  { bg: "linear-gradient(135deg,#022c22 0%,#34d399 100%)", fg: "#022c22" },
  { bg: "linear-gradient(135deg,#0c3f2e 0%,#0ea5e9 100%)", fg: "#e0f2fe" },
  { bg: "linear-gradient(135deg,#052e1a 0%,#16a34a 100%)", fg: "#dcfce7" },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function campaignGradient(c: Campaign): { bg: string; fg: string } {
  return GRADIENTS[hash(c.id || c.slug || c.name) % GRADIENTS.length];
}

// Short wordmark shown large on the fallback banner (brand name, else campaign).
export function campaignWordmark(c: Campaign): string {
  return (c.brand_name || c.name || "Lumina").trim();
}

// Compact pay badge for the corner of a card, matching SideShift ("$20/post").
export function payBadge(c: Campaign): string {
  if (c.cpm_rate) return `${fmtMoney(c.cpm_rate)} / 1k`;
  if (c.per_post_amount) return `${fmtMoney(c.per_post_amount)} / post`;
  if (c.hourly_rate) return `${fmtMoney(c.hourly_rate)} / hr`;
  if (c.fixed_amount) return `${fmtMoney(c.fixed_amount)} one-time`;
  return "Paid on views";
}

// A short "type" tag shown under the brand name (e.g. "High-volume UGC").
export function campaignTag(c: Campaign): string {
  const raw = c.content_type || c.job_type || (c.mode === "create_new" ? "Create new content" : "Repost clips");
  return raw.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
