// Typed API client — the contract with the FastAPI backend. Keep in lockstep with Pydantic schemas.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function apiFetch<T>(
  path: string,
  opts: { method?: string; token?: string; body?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(detail.detail ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type Health = {
  status: string;
  service: string;
  version: string;
  environment: string;
};

// ── Enums (mirror backend Postgres enums) ─────────────────────────────────────
export const GENDERS = [
  "male",
  "female",
  "non_binary",
  "other",
  "prefer_not_to_say",
] as const;
export type Gender = (typeof GENDERS)[number];

export const PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "twitter",
  "facebook",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const UPLOAD_PURPOSES = [
  "avatar",
  "portfolio_video",
  "proof_video",
] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

// ── Creator profile schemas ───────────────────────────────────────────────────
export type ProfileIn = {
  display_name?: string;
  bio?: string;
  date_of_birth?: string; // YYYY-MM-DD
  gender?: Gender;
  ethnicity?: string;
  primary_language?: string;
  languages?: string[];
  country?: string;
  city?: string;
  avatar_object_id?: string;
};

export type ProfileOut = {
  display_name: string | null;
  bio: string | null;
  date_of_birth: string | null;
  gender: Gender | null;
  ethnicity: string | null;
  primary_language: string | null;
  languages: string[];
  country: string | null;
  city: string | null;
  avatar_object_id: string | null;
  completed: boolean;
  missing: string[];
};

export type CompletionOut = {
  completed: boolean;
  missing: string[];
};

export type SocialIn = {
  platform: Platform;
  handle: string;
  profile_url?: string;
  follower_count?: number;
};

export type SocialOut = {
  id: string;
  platform: Platform;
  handle: string;
  profile_url: string | null;
  follower_count: number;
  is_verified: boolean;
};

export type PortfolioIn = {
  storage_object_id: string;
  thumbnail_url?: string;
  brand_name?: string;
  caption?: string;
  platform?: Platform;
};

export type PortfolioOut = {
  id: string;
  storage_object_id: string;
  thumbnail_url: string | null;
  brand_name: string | null;
  caption: string | null;
  platform: Platform | null;
};

// ── Uploads schemas ───────────────────────────────────────────────────────────
export type PresignIn = {
  purpose: UploadPurpose;
  content_type?: string;
  filename?: string;
  size_bytes?: number;
};

export type PresignOut = {
  object_id: string;
  object_key: string;
  upload_url: string;
};

export type StorageObjectOut = {
  id: string;
  purpose: UploadPurpose;
  status: string;
  content_type: string | null;
};

// ── Admin creators schemas ────────────────────────────────────────────────────
export type CreatorListItem = {
  id: string;
  email: string;
  display_name: string | null;
  gender: Gender | null;
  country: string | null;
  primary_language: string | null;
  total_followers: number;
  platforms: Platform[];
  completed: boolean;
};

export type SocialItem = {
  platform: Platform;
  handle: string;
  profile_url: string | null;
  follower_count: number;
};

export type PortfolioItemOut = {
  id: string;
  brand_name: string | null;
  caption: string | null;
  platform: Platform | null;
};

export type CreatorDetail = {
  id: string;
  email: string;
  display_name: string | null;
  bio: string | null;
  date_of_birth: string | null;
  gender: Gender | null;
  ethnicity: string | null;
  primary_language: string | null;
  languages: string[];
  country: string | null;
  city: string | null;
  completed: boolean;
  socials: SocialItem[];
  portfolio: PortfolioItemOut[];
};

export type CreatorFilters = {
  q?: string;
  gender?: Gender;
  ethnicity?: string;
  primary_language?: string;
  country?: string;
  city?: string;
  age_min?: number;
  age_max?: number;
  platform?: Platform;
  min_followers?: number;
  completed_only?: boolean;
  limit?: number;
  offset?: number;
};

// ── Creator profile methods (creator bearer token) ────────────────────────────
export const getProfile = (token: string) =>
  apiFetch<ProfileOut>("/api/creator/profile", { token });

export const updateProfile = (token: string, body: ProfileIn) =>
  apiFetch<ProfileOut>("/api/creator/profile", {
    method: "PUT",
    body: JSON.stringify(body),
    token,
  });

export const getCompletion = (token: string) =>
  apiFetch<CompletionOut>("/api/creator/profile/completion", { token });

export const listSocials = (token: string) =>
  apiFetch<SocialOut[]>("/api/creator/profile/socials", { token });

export const addSocial = (token: string, body: SocialIn) =>
  apiFetch<SocialOut>("/api/creator/profile/socials", {
    method: "POST",
    body: JSON.stringify(body),
    token,
  });

export const deleteSocial = (token: string, id: string) =>
  apiFetch<void>(`/api/creator/profile/socials/${id}`, {
    method: "DELETE",
    token,
  });

export const listPortfolio = (token: string) =>
  apiFetch<PortfolioOut[]>("/api/creator/profile/portfolio", { token });

export const addPortfolio = (token: string, body: PortfolioIn) =>
  apiFetch<PortfolioOut>("/api/creator/profile/portfolio", {
    method: "POST",
    body: JSON.stringify(body),
    token,
  });

export const deletePortfolio = (token: string, id: string) =>
  apiFetch<void>(`/api/creator/profile/portfolio/${id}`, {
    method: "DELETE",
    token,
  });

// ── Uploads methods (creator bearer token) ────────────────────────────────────
export const presignUpload = (token: string, body: PresignIn) =>
  apiFetch<PresignOut>("/api/creator/uploads/presign", {
    method: "POST",
    body: JSON.stringify(body),
    token,
  });

export const finalizeUpload = (token: string, objectId: string) =>
  apiFetch<StorageObjectOut>(`/api/creator/uploads/${objectId}/finalize`, {
    method: "POST",
    token,
  });

// Uploads the raw file bytes to the presigned URL (S3/R2 PUT). Not a JSON call,
// so it bypasses apiFetch.
export async function putToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: file.type ? { "Content-Type": file.type } : undefined,
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed (HTTP ${res.status})`);
}

// Runs the full presign → PUT → finalize lifecycle and returns the finalized object id.
export async function uploadFile(
  token: string,
  file: File,
  purpose: UploadPurpose,
): Promise<string> {
  const presigned = await presignUpload(token, {
    purpose,
    content_type: file.type || undefined,
    filename: file.name || undefined,
    size_bytes: file.size,
  });
  await putToPresignedUrl(presigned.upload_url, file);
  const finalized = await finalizeUpload(token, presigned.object_id);
  return finalized.id;
}

// ── Admin creators methods (admin bearer token) ───────────────────────────────
export const listCreators = (token: string, filters: CreatorFilters = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return apiFetch<CreatorListItem[]>(
    `/api/admin/creators${qs ? `?${qs}` : ""}`,
    { token },
  );
};

export const getCreatorDetail = (token: string, id: string) =>
  apiFetch<CreatorDetail>(`/api/admin/creators/${id}`, { token });
