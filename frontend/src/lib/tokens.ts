// Persistent auth-token storage. localStorage (not sessionStorage) so a signed-in
// user stays signed in across tab-close and browser restart. We keep the refresh
// token alongside the access token so the client can silently renew.
export type Realm = "creator" | "admin" | "client";

const KEY: Record<Realm, string> = {
  creator: "lumina.creator.session",
  admin: "lumina.admin.session",
  client: "lumina.client.session",
};

type Session = { access: string; refresh?: string };

function read(realm: Realm): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY[realm]);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(realm: Realm, access: string, refresh?: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY[realm], JSON.stringify({ access, refresh }));
}

export const getAccess = (realm: Realm): string | null => read(realm)?.access ?? null;
export const getRefresh = (realm: Realm): string | null => read(realm)?.refresh ?? null;

export function clearSession(realm: Realm) {
  if (typeof window !== "undefined") localStorage.removeItem(KEY[realm]);
}

/** Which realm a request path belongs to — used to pick the right refresh endpoint. */
export function realmFromPath(path: string): Realm | null {
  if (path.startsWith("/api/admin/")) return "admin";
  if (path.startsWith("/api/client/")) return "client";
  if (path.startsWith("/api/creator/")) return "creator";
  return null;
}
