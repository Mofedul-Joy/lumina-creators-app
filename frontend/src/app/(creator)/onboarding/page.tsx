"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
// note: form is seeded from the server ONCE — later profile refetches (triggered
// by adding a social/portfolio) must not clobber the basics the user is typing.
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

const labelCls = "block text-sm font-medium text-[var(--color-text)]";
const controlCls =
  "min-h-11 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-base text-[var(--color-text)] outline-none transition focus-visible:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]";
const cardCls = "card-grad rounded-[var(--radius-card)] p-6 space-y-4";

const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X (Twitter)",
  facebook: "Facebook",
};

type ProfileForm = {
  display_name: string;
  bio: string;
  date_of_birth: string;
  gender: string;
  ethnicity: string;
  primary_language: string;
  country: string;
  city: string;
};
const EMPTY: ProfileForm = {
  display_name: "", bio: "", date_of_birth: "", gender: "",
  ethnicity: "", primary_language: "", country: "", city: "",
};
// Basics that block "Save & continue" when empty.
const REQUIRED: (keyof ProfileForm)[] = ["display_name", "date_of_birth", "gender", "primary_language", "country"];
const REQUIRED_MSG = "This field is required to continue.";

export default function OnboardingPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setToken(getAuthToken());
    setReady(true);
  }, []);
  const enabled = ready && !!token;
  const bearer = token ?? "";

  // Fetch the profile ONCE — it seeds the editable form, so it must never
  // refetch underneath the user (window-focus / invalidation) and wipe edits.
  const profileQ = useQuery({
    queryKey: ["profile"], queryFn: () => getProfile(bearer), enabled, retry: false,
    staleTime: Infinity, refetchOnWindowFocus: false, refetchOnMount: false,
  });
  const socialsQ = useQuery({ queryKey: ["socials"], queryFn: () => listSocials(bearer), enabled, retry: false });
  const portfolioQ = useQuery({ queryKey: ["portfolio"], queryFn: () => listPortfolio(bearer), enabled, retry: false });

  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileForm | "social" | "portfolio", string>>>({});
  const [banner, setBanner] = useState("");
  const seeded = useRef(false);
  useEffect(() => {
    if (profileQ.isError) router.replace("/login");
  }, [profileQ.isError, router]);
  useEffect(() => {
    const d = profileQ.data;
    if (d && !seeded.current) {
      seeded.current = true;
      setForm({
        display_name: d.display_name ?? "", bio: d.bio ?? "", date_of_birth: d.date_of_birth ?? "",
        gender: d.gender ?? "", ethnicity: d.ethnicity ?? "", primary_language: d.primary_language ?? "",
        country: d.country ?? "", city: d.city ?? "",
      });
    }
  }, [profileQ.data]);

  // Avatar upload. Show the picked file INSTANTLY via a local object URL so the
  // circle fills immediately, while the (multi-step) upload runs in the background.
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const avatarM = useMutation({
    mutationFn: async (file: File) => {
      const objectId = await uploadFile(bearer, file, "avatar");
      return updateProfile(bearer, { avatar_object_id: objectId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
    onError: () => setLocalPreview(null), // upload failed — drop the optimistic preview
  });
  function pickAvatar(file: File) {
    setLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    avatarM.mutate(file);
  }

  // Social add (per platform).
  const [openPlatform, setOpenPlatform] = useState<Platform | null>(null);
  const [socialForm, setSocialForm] = useState({ handle: "", profile_url: "", follower_count: "" });
  const addSocialM = useMutation({
    mutationFn: () =>
      addSocial(bearer, {
        platform: openPlatform!,
        handle: socialForm.handle.trim(),
        profile_url: socialForm.profile_url.trim() || undefined,
        follower_count: Number(socialForm.follower_count) || 0,
      }),
    onSuccess: () => {
      setOpenPlatform(null);
      setSocialForm({ handle: "", profile_url: "", follower_count: "" });
      qc.invalidateQueries({ queryKey: ["socials"] });
      setErrors((e) => ({ ...e, social: undefined }));
    },
  });
  const removeSocialM = useMutation({
    mutationFn: (id: string) => deleteSocial(bearer, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["socials"] }),
  });

  // Portfolio add (by link).
  const [portfolioForm, setPortfolioForm] = useState({ video_url: "", brand_name: "", caption: "" });
  const addPortfolioM = useMutation({
    mutationFn: () =>
      addPortfolio(bearer, {
        video_url: portfolioForm.video_url.trim(),
        brand_name: portfolioForm.brand_name.trim() || undefined,
        caption: portfolioForm.caption.trim() || undefined,
      }),
    onSuccess: () => {
      setPortfolioForm({ video_url: "", brand_name: "", caption: "" });
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      setErrors((e) => ({ ...e, portfolio: undefined }));
    },
  });
  const removePortfolioM = useMutation({
    mutationFn: (id: string) => deletePortfolio(bearer, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }),
  });

  const socials = socialsQ.data ?? [];
  const portfolio = portfolioQ.data ?? [];
  const avatarUrl = profileQ.data?.avatar_url ?? null;
  // Live completeness for the footer (profileQ is frozen after first load).
  const looksComplete =
    REQUIRED.every((f) => form[f].trim()) && socials.length > 0 && portfolio.length > 0;

  // Save & continue: validate everything, block if incomplete, else save + go.
  const saveM = useMutation({
    mutationFn: () => updateProfile(bearer, cleanPatch(form)),
    onSuccess: (data) => {
      if (data.completed) {
        router.push("/dashboard");
      } else {
        setBanner("Almost there — a couple of required items are still missing.");
      }
    },
    onError: (err) => setBanner((err as Error).message),
  });

  function saveAndContinue() {
    const next: typeof errors = {};
    for (const f of REQUIRED) if (!form[f].trim()) next[f] = REQUIRED_MSG;
    if (socials.length === 0) next.social = "Add at least one social account.";
    if (portfolio.length === 0) next.portfolio = "Add at least one video link.";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setBanner("Please fill in the required fields marked in red before continuing.");
      const first = document.querySelector('[aria-invalid="true"], [data-invalid="true"]');
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBanner("");
    saveM.mutate();
  }

  if (ready && !token)
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Please sign in</h1>
        <Link href="/login" className="text-[var(--color-brand)] underline">Go to sign in</Link>
      </main>
    );

  // Wait for the profile to load and seed the form BEFORE the user can type,
  // otherwise a slow fetch resolves mid-typing and the seed wipes their input.
  if (!ready || !token || profileQ.isLoading || !seeded.current)
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
      </main>
    );

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 pb-28 space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Creator workspace</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Build your profile</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Fields marked <span className="text-[var(--color-danger)]">*</span> are required. Complete them to unlock campaigns.
        </p>
      </header>

      {banner ? (
        <div role="alert" className="rounded-[var(--radius-btn)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
          {banner}
        </div>
      ) : null}

      {/* BASICS */}
      <section className={cardCls}>
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Basics</h2>

        <div className="flex items-center gap-4">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text-muted)]">
            {localPreview ?? avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={(localPreview ?? avatarUrl)!} alt="Your avatar" className="h-full w-full object-cover" />
            ) : (
              "No photo"
            )}
            {avatarM.isPending ? (
              <span className="absolute inset-0 grid place-items-center bg-black/50">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              </span>
            ) : null}
          </div>
          <div className="space-y-2">
            <label className={labelCls}>Profile photo</label>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pickAvatar(file);
              }}
            />
            <div className="w-40">
              <Button type="button" loading={avatarM.isPending} onClick={() => avatarInputRef.current?.click()}>
                {(localPreview ?? avatarUrl) ? "Replace photo" : "Upload photo"}
              </Button>
            </div>
            {avatarM.isPending ? (
              <p className="text-xs text-[var(--color-text-muted)]">Uploading your photo…</p>
            ) : null}
            {avatarM.isError ? <p className="text-sm text-[var(--color-danger)]">Upload failed — please try again.</p> : null}
          </div>
        </div>

        <Field
          label="Display name"
          requiredMark
          value={form.display_name}
          error={errors.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
        />
        <div className="space-y-2">
          <label className={labelCls}>Bio</label>
          <textarea rows={3} className={controlCls + " py-2"} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Date of birth"
            type="date"
            requiredMark
            value={form.date_of_birth}
            error={errors.date_of_birth}
            onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
          />
          <div className="space-y-2">
            <label className={labelCls}>
              Gender<span className="ml-0.5 text-[var(--color-danger)]">*</span>
            </label>
            <select
              className={`${controlCls} ${errors.gender ? "border-[var(--color-danger)]" : ""}`}
              data-invalid={errors.gender ? "true" : "false"}
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="">Select…</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>{g.replace(/_/g, " ")}</option>
              ))}
            </select>
            {errors.gender ? <p className="text-sm text-[var(--color-danger)]">{errors.gender}</p> : null}
          </div>
          <Field
            label="Primary language"
            requiredMark
            value={form.primary_language}
            error={errors.primary_language}
            onChange={(e) => setForm({ ...form, primary_language: e.target.value })}
          />
          <Field
            label="Country"
            requiredMark
            value={form.country}
            error={errors.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
          <Field label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <Field label="Ethnicity" value={form.ethnicity} onChange={(e) => setForm({ ...form, ethnicity: e.target.value })} />
        </div>
      </section>

      {/* SOCIAL ACCOUNTS */}
      <section className={cardCls}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            Social accounts<span className="ml-0.5 text-[var(--color-danger)]">*</span>
          </h2>
          <span className="tabular text-sm text-[var(--color-text-muted)]">{socials.length} added</span>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          At least one is required. <span className="text-[var(--color-brand-soft)]">Creators with 3+ platforms get matched to more campaigns</span> — add every account you post on.
        </p>
        {errors.social ? <p data-invalid="true" className="text-sm text-[var(--color-danger)]">{errors.social}</p> : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PLATFORMS.map((p) => {
            const existing = socials.find((s) => s.platform === p);
            const isOpen = openPlatform === p;
            return (
              <div
                key={p}
                className={`rounded-[var(--radius-btn)] border p-3 transition ${
                  existing ? "border-[var(--color-brand)]/40 bg-[var(--color-brand)]/5" : "border-[var(--color-border)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--color-text)]">{PLATFORM_LABEL[p]}</span>
                  {existing ? (
                    <button className="cursor-pointer text-xs text-[var(--color-danger)]" onClick={() => removeSocialM.mutate(existing.id)}>
                      Remove
                    </button>
                  ) : (
                    <button
                      className="cursor-pointer text-xs font-medium text-[var(--color-brand)]"
                      onClick={() => {
                        setOpenPlatform(isOpen ? null : p);
                        setSocialForm({ handle: "", profile_url: "", follower_count: "" });
                      }}
                    >
                      {isOpen ? "Cancel" : "+ Add"}
                    </button>
                  )}
                </div>

                {existing ? (
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    @{existing.handle} · <span className="tabular">{existing.follower_count.toLocaleString()}</span> followers
                  </p>
                ) : isOpen ? (
                  <div className="mt-3 space-y-2">
                    <input
                      className={controlCls + " text-sm"}
                      placeholder="handle (without @)"
                      value={socialForm.handle}
                      onChange={(e) => setSocialForm({ ...socialForm, handle: e.target.value })}
                    />
                    <input
                      className={controlCls + " text-sm"}
                      type="number"
                      placeholder="follower count"
                      value={socialForm.follower_count}
                      onChange={(e) => setSocialForm({ ...socialForm, follower_count: e.target.value })}
                    />
                    <input
                      className={controlCls + " text-sm"}
                      placeholder="profile URL (optional)"
                      value={socialForm.profile_url}
                      onChange={(e) => setSocialForm({ ...socialForm, profile_url: e.target.value })}
                    />
                    {addSocialM.isError ? <p className="text-xs text-[var(--color-danger)]">{(addSocialM.error as Error).message}</p> : null}
                    <Button type="button" loading={addSocialM.isPending} disabled={!socialForm.handle.trim()} onClick={() => addSocialM.mutate()}>
                      Add {PLATFORM_LABEL[p]}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* PORTFOLIO (links) */}
      <section className={cardCls}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            Best videos<span className="ml-0.5 text-[var(--color-danger)]">*</span>
          </h2>
          <span className="tabular text-sm text-[var(--color-text-muted)]">{portfolio.length} added</span>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Paste a link to your best content (TikTok, Instagram, YouTube, X, or Facebook) — no heavy uploads, just the URL.
        </p>
        {errors.portfolio ? <p data-invalid="true" className="text-sm text-[var(--color-danger)]">{errors.portfolio}</p> : null}

        <ul className="space-y-2">
          {portfolio.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-btn)] border border-[var(--color-border)] px-3 py-2">
              <a href={p.video_url ?? "#"} target="_blank" rel="noreferrer" className="min-w-0 truncate text-sm text-[var(--color-brand)] hover:underline">
                {p.brand_name ? `${p.brand_name} · ` : ""}{p.video_url}
              </a>
              <button className="shrink-0 cursor-pointer text-xs text-[var(--color-danger)]" onClick={() => removePortfolioM.mutate(p.id)}>
                Remove
              </button>
            </li>
          ))}
          {portfolio.length === 0 ? <li className="text-sm text-[var(--color-text-muted)]">No videos added yet.</li> : null}
        </ul>

        <div className="space-y-2">
          <input
            className={controlCls}
            placeholder="https://tiktok.com/@you/video/…"
            value={portfolioForm.video_url}
            onChange={(e) => setPortfolioForm({ ...portfolioForm, video_url: e.target.value })}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input className={controlCls + " text-sm"} placeholder="Brand (optional)" value={portfolioForm.brand_name} onChange={(e) => setPortfolioForm({ ...portfolioForm, brand_name: e.target.value })} />
            <input className={controlCls + " text-sm"} placeholder="Caption (optional)" value={portfolioForm.caption} onChange={(e) => setPortfolioForm({ ...portfolioForm, caption: e.target.value })} />
          </div>
          {addPortfolioM.isError ? <p className="text-sm text-[var(--color-danger)]">{(addPortfolioM.error as Error).message}</p> : null}
          <div className="w-40">
            <Button type="button" loading={addPortfolioM.isPending} disabled={!portfolioForm.video_url.trim()} onClick={() => addPortfolioM.mutate()}>
              Add video link
            </Button>
          </div>
        </div>
      </section>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-border)] bg-[var(--color-bg-deep)]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {looksComplete ? "All set — save to continue ✓" : "Complete the required fields to continue"}
          </p>
          <div className="w-48">
            <Button type="button" loading={saveM.isPending} onClick={saveAndContinue}>
              Save &amp; continue →
            </Button>
          </div>
        </div>
      </div>
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
  return out;
}
