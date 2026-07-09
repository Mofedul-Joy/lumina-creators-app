import type { Platform } from "@/lib/api";

// Guess which platform a pasted video URL belongs to, so a portfolio link can
// show the right icon and open back to the source on click.
export function platformFromUrl(url: string): Platform | null {
  const u = url.toLowerCase();
  if (/tiktok\.com/.test(u)) return "tiktok";
  if (/(youtube\.com|youtu\.be)/.test(u)) return "youtube";
  if (/instagram\.com/.test(u)) return "instagram";
  if (/(twitter\.com|x\.com)/.test(u)) return "twitter";
  if (/(facebook\.com|fb\.watch)/.test(u)) return "facebook";
  return null;
}

// Loose but real check: must be an http(s) URL with a host + a dot.
export function isValidVideoUrl(s: string): boolean {
  const t = s.trim();
  try {
    const u = new URL(t);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}
