import { apiFetch } from "@/lib/api";

export type CreatorLoginResult =
  | { status: "ok"; access_token: string; refresh_token?: string }
  | { status: "password_not_set"; email: string }
  | { status: "email_not_verified"; email: string };

export type CreatorSetPasswordResult = { status: "ok"; access_token: string; refresh_token?: string };
export type CreatorCheckEmailResult = { exists: boolean; password_set: boolean };
export type TokenResult = { access_token: string; refresh_token?: string };
export type SignupResult =
  | { status: "verification_sent"; email: string; dev_code: string | null }
  | { status: "ok"; access_token: string; refresh_token?: string };

// Sessions persist in localStorage (see lib/tokens.ts) so a signed-in user stays
// signed in across tab-close and browser restart; the access token is silently
// refreshed by apiFetch, so idle time never forces re-login.
import { clearSession, getAccess, saveSession } from "@/lib/tokens";

export const setAuthToken = (access: string, refresh?: string) => saveSession("creator", access, refresh);
export const getAuthToken = () => getAccess("creator");
export const clearAuthToken = () => clearSession("creator");
export const setAdminToken = (access: string, refresh?: string) => saveSession("admin", access, refresh);
export const getAdminToken = () => getAccess("admin");
export const clearAdminToken = () => clearSession("admin");
export const setClientToken = (access: string, refresh?: string) => saveSession("client", access, refresh);
export const getClientToken = () => getAccess("client");
export const clearClientToken = () => clearSession("client");

export function creatorSignup(email: string, password: string, displayName?: string) {
  return apiFetch<SignupResult>("/api/creator/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, display_name: displayName || undefined }),
  });
}

export function verifyEmailCode(email: string, code: string) {
  return apiFetch<TokenResult>("/api/creator/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export function resendEmailCode(email: string) {
  return apiFetch<{ status: string; dev_code: string | null }>("/api/creator/auth/resend-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function creatorLogin(email: string, password: string) {
  return apiFetch<CreatorLoginResult>("/api/creator/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function creatorSetPassword(email: string, password: string) {
  return apiFetch<CreatorSetPasswordResult>("/api/creator/auth/set-password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function creatorCheckEmail(email: string) {
  return apiFetch<CreatorCheckEmailResult>(
    `/api/creator/auth/check-email?email=${encodeURIComponent(email)}`,
  );
}

export function adminLogin(email: string, password: string) {
  return apiFetch<TokenResult>("/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function clientLogin(email: string, password: string) {
  return apiFetch<TokenResult>("/api/client/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
