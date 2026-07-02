import { apiFetch } from "@/lib/api";

export type CreatorLoginResult =
  | { status: "ok"; access_token: string }
  | { status: "password_not_set"; email: string }
  | { status: "email_not_verified"; email: string };

export type CreatorSetPasswordResult = { status: "ok"; access_token: string };
export type CreatorCheckEmailResult = { exists: boolean; password_set: boolean };
export type TokenResult = { access_token: string };
export type SignupResult = { status: "verification_sent"; email: string; dev_code: string | null };

// Tokens persist in sessionStorage so a page refresh keeps the session while a
// closed tab still forgets it. Guarded for SSR (no window on the server).
// TODO: move to httpOnly-cookie storage when the backend refresh flow lands.
function tokenStore(key: string) {
  let mem: string | null = null;
  return {
    set(next: string) {
      mem = next;
      if (typeof window !== "undefined") sessionStorage.setItem(key, next);
    },
    get(): string | null {
      if (mem) return mem;
      if (typeof window !== "undefined") mem = sessionStorage.getItem(key);
      return mem;
    },
    clear() {
      mem = null;
      if (typeof window !== "undefined") sessionStorage.removeItem(key);
    },
  };
}

const creatorStore = tokenStore("lumina.creator.token");
const adminStore = tokenStore("lumina.admin.token");
const clientStore = tokenStore("lumina.client.token");

export const setAuthToken = creatorStore.set;
export const getAuthToken = creatorStore.get;
export const clearAuthToken = creatorStore.clear;
export const setAdminToken = adminStore.set;
export const getAdminToken = adminStore.get;
export const clearAdminToken = adminStore.clear;
export const setClientToken = clientStore.set;
export const getClientToken = clientStore.get;
export const clearClientToken = clientStore.clear;

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
