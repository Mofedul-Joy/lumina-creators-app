import { apiFetch } from "@/lib/api";

export type CreatorLoginResult =
  | { status: "ok"; access_token: string }
  | { status: "password_not_set"; email: string };

export type CreatorSetPasswordResult = { status: "ok"; access_token: string };
export type CreatorCheckEmailResult = { exists: boolean; password_set: boolean };
export type TokenResult = { access_token: string };

let token: string | null = null;
let adminToken: string | null = null;

// TODO: replace these in-memory holders with secure httpOnly-cookie storage when the backend refresh flow lands.
export function setAuthToken(nextToken: string) {
  token = nextToken;
}

export function getAuthToken() {
  return token;
}

export function clearAuthToken() {
  token = null;
}

export function setAdminToken(nextToken: string) {
  adminToken = nextToken;
}

export function getAdminToken() {
  return adminToken;
}

export function clearAdminToken() {
  adminToken = null;
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
