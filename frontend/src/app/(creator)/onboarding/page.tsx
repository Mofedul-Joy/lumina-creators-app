"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { getAuthToken } from "@/lib/auth";
import {
  GENDERS,
  PLATFORMS,
  addPortfolio,
  addSocial,
  deletePortfolio,
  deleteSocial,
  getProfile,
  listPortfolio,
  listSocials,
  updateProfile,
  uploadFile,
  type Platform,
  type ProfileIn,
} from "@/lib/api";

const LABELS: Record<string, string> = {
  display_name: "Display name",
  bio: "Bio",
  date_of_birth: "Date of birth",
  gender: "Gender",
  ethnicity: "Ethnicity",
  primary_language: "Primary language",
  country: "Country",
  city: "City",
  social_account: "At least one social account",
  portfolio_item: "At least one portfolio video",
};

const labelCls = "block text-sm font-medium text-[var(--color-text)]";
const controlCls =
  "min-h-11 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-base text-[var(--color-text)] outline-none focus-visible:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]";
const cardCls =
  "card-grad rounded-[var(--radius-card)] p-5 space-y-4";

type ProfileForm = {
  display_name: string;
  bio: string;
  date_of_birth: string;
  gender: string;
  ethnicity: string;
  primary_language: string;
  languages: string[];
  country: string;
  city: string;
};

const EMPTY_FORM: ProfileForm = {
  display_name: "",
  bio: "",
  date_of_birth: "",
  gender: "",
  ethnicity: "",
  primary_language: "",
  languages: [],
  country: "",
  city: "",
};

export default function OnboardingPage() {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setToken(getAuthToken());
    setReady(true);
  }, []);

  const enabled = ready && !!token;
  const bearer = token ?? "";

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: () => getProfile(bearer),
    enabled,
    retry: false,
  });
  const socialsQ = useQuery({
    queryKey: ["socials"],
    queryFn: () => listSocials(bearer),
    enabled,
    retry: false,
  });
  const portfolioQ = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => listPortfolio(bearer),
    enabled,
    retry: false,
  });

  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  useEffect(() => {
    const d = profileQ.data;
    if (d)
      setForm({
        display_name: d.display_name ?? "",
        bio: d.bio ?? "",
        date_of_birth: d.date_of_birth ?? "",
        gender: d.gender ?? "",
        ethnicity: d.ethnicity ?? "",
        primary_language: d.primary_language ?? "",
        languages: d.languages ?? [],
        country: d.country ?? "",
        city: d.city ?? "",
      });
  }, [profileQ.data]);

  const saveM = useMutation({
    mutationFn: () => updateProfile(bearer, cleanPatch(form)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  // Avatar upload
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarM = useMutation({
    mutationFn: async (file: File) => {
      const objectId = await uploadFile(bearer, file, "avatar");
      return updateProfile(bearer, { avatar_object_id: objectId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  // Socials
  const [social, setSocial] = useState<{
    platform: Platform;
    handle: string;
    profile_url: string;
    follower_count: string;
  }>({ platform: "instagram", handle: "", profile_url: "", follower_count: "" });
  const addSocialM = useMutation({
    mutationFn: () =>
      addSocial(bearer, {
        platform: social.platform,
        handle: social.handle.trim(),
        profile_url: social.profile_url.trim() || undefined,
        follower_count: Number(social.follower_count) || 0,
      }),
    onSuccess: () => {
      setSocial({ platform: "instagram", handle: "", profile_url: "", follower_count: "" });
      qc.invalidateQueries({ queryKey: ["socials"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
  const removeSocialM = useMutation({
    mutationFn: (id: string) => deleteSocial(bearer, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["socials"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  // Portfolio
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const [portfolioMeta, setPortfolioMeta] = useState<{
    brand_name: string;
    caption: string;
    platform: Platform | "";
  }>({ brand_name: "", caption: "", platform: "" });
  const addPortfolioM = useMutation({
    mutationFn: async (file: File) => {
      const objectId = await uploadFile(bearer, file, "portfolio_video");
      return addPortfolio(bearer, {
        storage_object_id: objectId,
        brand_name: portfolioMeta.brand_name.trim() || undefined,
        caption: portfolioMeta.caption.trim() || undefined,
        platform: portfolioMeta.platform || undefined,
      });
    },
    onSuccess: () => {
      setPortfolioMeta({ brand_name: "", caption: "", platform: "" });
      if (portfolioInputRef.current) portfolioInputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
  const removePortfolioM = useMutation({
    mutationFn: (id: string) => deletePortfolio(bearer, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  if (ready && !token)
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Please sign in</h1>
        <p className="text-[var(--color-text-secondary)]">
          You need to be signed in to build your creator profile.
        </p>
        <Link href="/login" className="text-[var(--color-brand)] underline">
          Go to sign in
        </Link>
      </main>
    );

  const missing = profileQ.data?.missing ?? [];
  const complete = profileQ.data?.completed ?? false;
  const avatarSet = !!profileQ.data?.avatar_object_id;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Creator workspace</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Build your profile</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Complete your profile to browse and enter campaigns.
        </p>
      </header>

      {/* completion banner */}
      <div
        className="rounded-[var(--radius-card)] border p-4"
        style={{
          borderColor: complete ? "var(--color-brand)" : "var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        {complete ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--color-brand)]">
              Profile complete — you can enter campaigns.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-btn)] bg-[var(--color-brand)] px-4 text-sm font-semibold text-[var(--color-on-brand)] transition duration-200 hover:bg-[var(--color-brand-hover)]"
            >
              Browse campaigns
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-[var(--color-text)]">Still needed to finish your profile:</p>
            <ul className="text-sm text-[var(--color-text-secondary)]">
              {missing.length === 0 ? (
                <li>{profileQ.isLoading ? "Loading…" : "—"}</li>
              ) : (
                missing.map((m) => <li key={m}>• {LABELS[m] ?? m}</li>)
              )}
            </ul>
          </div>
        )}
      </div>

      {profileQ.isError ? (
        <p className="text-sm text-[var(--color-danger)]">
          {(profileQ.error as Error).message}
        </p>
      ) : null}

      {/* basics */}
      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Basics</h2>

        {/* avatar */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text-muted)]">
            {avatarSet ? "Set" : "None"}
          </div>
          <div className="space-y-2">
            <label className={labelCls}>Avatar</label>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) avatarM.mutate(file);
              }}
            />
            <div className="w-40">
              <Button
                type="button"
                loading={avatarM.isPending}
                onClick={() => avatarInputRef.current?.click()}
              >
                {avatarSet ? "Replace" : "Upload"}
              </Button>
            </div>
            {avatarM.isError ? (
              <p className="text-sm text-[var(--color-danger)]">
                {(avatarM.error as Error).message}
              </p>
            ) : null}
          </div>
        </div>

        <Field
          label="Display name"
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
        />
        <div className="space-y-2">
          <label className={labelCls}>Bio</label>
          <textarea
            rows={3}
            className={controlCls + " py-2"}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Date of birth"
            type="date"
            value={form.date_of_birth}
            onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
          />
          <div className="space-y-2">
            <label className={labelCls}>Gender</label>
            <select
              className={controlCls}
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="">Select…</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Primary language"
            value={form.primary_language}
            onChange={(e) => setForm({ ...form, primary_language: e.target.value })}
          />
          <Field
            label="Ethnicity"
            value={form.ethnicity}
            onChange={(e) => setForm({ ...form, ethnicity: e.target.value })}
          />
          <Field
            label="Country"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
          <Field
            label="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
        <Field
          label="Languages (comma-separated)"
          value={form.languages.join(", ")}
          onChange={(e) =>
            setForm({
              ...form,
              languages: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
        {saveM.isError ? (
          <p className="text-sm text-[var(--color-danger)]">{(saveM.error as Error).message}</p>
        ) : null}
        <div className="w-40">
          <Button type="button" loading={saveM.isPending} onClick={() => saveM.mutate()}>
            Save
          </Button>
        </div>
      </section>

      {/* socials */}
      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Social accounts</h2>
        <ul className="space-y-2">
          {(socialsQ.data ?? []).map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-[var(--radius-btn)] border border-[var(--color-border)] px-3 py-2"
            >
              <span className="text-sm text-[var(--color-text)]">
                {s.platform} · @{s.handle} ·{" "}
                <span className="tabular">{s.follower_count.toLocaleString()}</span> followers
              </span>
              <button
                className="cursor-pointer text-sm text-[var(--color-danger)]"
                onClick={() => removeSocialM.mutate(s.id)}
              >
                Remove
              </button>
            </li>
          ))}
          {socialsQ.data?.length === 0 ? (
            <li className="text-sm text-[var(--color-text-muted)]">No social accounts yet.</li>
          ) : null}
        </ul>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className={labelCls}>Platform</label>
            <select
              className={controlCls}
              value={social.platform}
              onChange={(e) => setSocial({ ...social, platform: e.target.value as Platform })}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Handle"
            value={social.handle}
            onChange={(e) => setSocial({ ...social, handle: e.target.value })}
          />
          <Field
            label="Profile URL"
            value={social.profile_url}
            onChange={(e) => setSocial({ ...social, profile_url: e.target.value })}
          />
          <Field
            label="Followers"
            type="number"
            value={social.follower_count}
            onChange={(e) => setSocial({ ...social, follower_count: e.target.value })}
          />
        </div>
        <div className="w-full sm:w-28">
          <Button
            type="button"
            loading={addSocialM.isPending}
            disabled={!social.handle.trim()}
            onClick={() => addSocialM.mutate()}
          >
            Add
          </Button>
        </div>
        {addSocialM.isError ? (
          <p className="text-sm text-[var(--color-danger)]">
            {(addSocialM.error as Error).message}
          </p>
        ) : null}
      </section>

      {/* portfolio */}
      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Portfolio videos</h2>
        <ul className="space-y-2">
          {(portfolioQ.data ?? []).map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-[var(--radius-btn)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)]"
            >
              <span>
                {p.brand_name ?? "Untitled"}
                {p.platform ? ` · ${p.platform}` : ""}
                {p.caption ? ` · ${p.caption}` : ""}
              </span>
              <button
                className="cursor-pointer text-sm text-[var(--color-danger)]"
                onClick={() => removePortfolioM.mutate(p.id)}
              >
                Remove
              </button>
            </li>
          ))}
          {portfolioQ.data?.length === 0 ? (
            <li className="text-sm text-[var(--color-text-muted)]">No portfolio videos yet.</li>
          ) : null}
        </ul>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Brand name"
            value={portfolioMeta.brand_name}
            onChange={(e) => setPortfolioMeta({ ...portfolioMeta, brand_name: e.target.value })}
          />
          <div className="space-y-2">
            <label className={labelCls}>Platform</label>
            <select
              className={controlCls}
              value={portfolioMeta.platform}
              onChange={(e) =>
                setPortfolioMeta({ ...portfolioMeta, platform: e.target.value as Platform | "" })
              }
            >
              <option value="">Select…</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Field
          label="Caption"
          value={portfolioMeta.caption}
          onChange={(e) => setPortfolioMeta({ ...portfolioMeta, caption: e.target.value })}
        />
        <input
          ref={portfolioInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) addPortfolioM.mutate(file);
          }}
        />
        <div className="w-full sm:w-48">
          <Button
            type="button"
            loading={addPortfolioM.isPending}
            onClick={() => portfolioInputRef.current?.click()}
          >
            Upload video
          </Button>
        </div>
        {addPortfolioM.isError ? (
          <p className="text-sm text-[var(--color-danger)]">
            {(addPortfolioM.error as Error).message}
          </p>
        ) : null}
      </section>
    </main>
  );
}

function cleanPatch(form: ProfileForm): ProfileIn {
  const out: ProfileIn = {};
  if (form.display_name) out.display_name = form.display_name;
  if (form.bio) out.bio = form.bio;
  if (form.date_of_birth) out.date_of_birth = form.date_of_birth;
  if (form.gender) out.gender = form.gender as ProfileIn["gender"];
  if (form.ethnicity) out.ethnicity = form.ethnicity;
  if (form.primary_language) out.primary_language = form.primary_language;
  if (form.country) out.country = form.country;
  if (form.city) out.city = form.city;
  out.languages = form.languages;
  return out;
}
