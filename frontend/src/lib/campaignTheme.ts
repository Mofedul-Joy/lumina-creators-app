import type { Campaign } from "@/lib/campaigns";
import { fmtMoney } from "@/lib/format";

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
