// Cross-realm URL builder.
//
// On ugcagency.io each realm is its OWN subdomain (creators./admin./client.),
// served by middleware.ts which rewrites the client. host onto /client/* and the
// admin. host onto /admin/*. So a same-origin path like "/client/dashboard" built
// on admin.ugcagency.io gets rewritten to "/admin/client/dashboard" → 404.
//
// On *.vercel.app and localhost all realms share ONE origin at path prefixes, so
// the plain "/client/…" / "/report/…" paths resolve directly.
//
// These helpers return a URL that resolves correctly in BOTH setups.

function onUgc(): boolean {
  return typeof window !== "undefined" && window.location.hostname.endsWith("ugcagency.io");
}

// Client realm. `subpath` is the path WITHOUT the /client prefix (e.g. "/dashboard",
// "/login?email=…"). On ugcagency the client app lives at client.ugcagency.io and
// the middleware adds /client; elsewhere it's a /client/* path on the shared origin.
export function clientRealmUrl(subpath: string): string {
  return onUgc() ? `https://client.ugcagency.io${subpath}` : `/client${subpath}`;
}

// Admin realm. `subpath` WITHOUT the /admin prefix (e.g. "/login?email=…").
export function adminRealmUrl(subpath: string): string {
  return onUgc() ? `https://admin.ugcagency.io${subpath}` : `/admin${subpath}`;
}

// Public pages (e.g. the /report share funnel) live at the ROOT — the creator app /
// apex on ugcagency, or the shared origin elsewhere — never under /admin. From the
// admin subdomain we must build an absolute apex URL so the link isn't rewritten.
export function publicRealmUrl(subpath: string): string {
  return onUgc() ? `https://ugcagency.io${subpath}` : subpath;
}
