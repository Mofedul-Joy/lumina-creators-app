import { NextRequest, NextResponse } from "next/server";

// Subdomain → section routing.
// Each customer-facing subdomain serves one part of the app while keeping the
// clean subdomain in the address bar (rewrite, not redirect).
//   creators.ugcagency.io → creator app (lives at the root, so no rewrite)
//   admin.ugcagency.io    → /admin
//   client.ugcagency.io   → /client (entry = /client/login)
// The apex + creators subdomain both serve the creator app unchanged.
const SECTIONS: Record<string, { base: string; home: string }> = {
  "admin.ugcagency.io": { base: "/admin", home: "/admin" },
  "client.ugcagency.io": { base: "/client", home: "/client/login" },
};

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const section = SECTIONS[host];
  if (!section) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // Already under the section prefix (e.g. an internal /admin/... link) → serve as-is.
  if (pathname === section.base || pathname.startsWith(section.base + "/")) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? section.home : section.base + pathname;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip Next internals and any file with an extension (static assets).
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
