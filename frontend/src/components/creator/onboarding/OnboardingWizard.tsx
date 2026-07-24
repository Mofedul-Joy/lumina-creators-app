"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { VideoModal } from "@/components/ui/VideoModal";
import { VideoThumb } from "@/components/ui/VideoThumb";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { getAuthToken } from "@/lib/auth";
import {
  CREATOR_TYPES, EDUCATION_LEVELS, GENDERS, PAYOUT_METHODS,
  type CreatorType, type EducationLevel, type Gender, type PayoutMethod, type Platform, type ProfileIn,
  addPortfolio, addSocial, confirmSocialVerify, deletePortfolio, deleteSocial, getProfile, listPortfolio, listSocials,
  startSocialVerify, updateProfile, uploadFile, uploadPortfolioVideo, retryNonAuth} from "@/lib/api";
import { isValidVideoUrl, platformFromUrl } from "@/lib/videoLink";
import { COUNTRIES } from "@/lib/countries";

// Progressive, one-question-per-screen onboarding — the granular SideShift-style
// flow in the Lumina dark-green skin. Save-as-you-go (no server completion gate);
// every step pre-fills from the profile so this doubles as "edit profile".

type StepKey =
  | "name" | "ugc_before" | "experience" | "brands" | "content_types" | "niches"
  | "type" | "bio" | "portfolio"
  | "posts_per_day" | "hours_per_week"
  | "birthday" | "gender" | "education" | "ethnicity" | "language" | "location" | "how_heard"
  | "whatsapp"
  | "socials" | "photo"
  | "testimonial" | "earnings"
  | "payment" | "done";

// Rev2 #2/#3: one Socials step with per-platform tabs (was 5 separate steps).
const SOCIAL_PLATFORMS: Platform[] = ["instagram", "tiktok", "youtube", "twitter", "facebook"];

// SideShift-style granular flow: name first, then experience/interests, the
// mandatory profile bits (creator type + a video + socials gate the join), then
// details, and reassurance/earnings before finish. `type`, `socials`, `portfolio`,
// `birthday`, `payment` keys stay so the ProfileGate deep-links still resolve.
// Rhys's rev4: the full SideShift-style onboarding is the MANDATORY post-signup
// flow again. A creator must complete it before reaching any tab (the sidebar is
// locked — see the /onboarding route rendering it full-screen). Order mirrors the
// feedback screenshots: name → background/personalization → socials → their best
// videos (right after socials) → schedule → demographics → location → how-heard →
// WhatsApp → photo → earnings → done. `socials` is the only hard-required step
// (the backend join-gate needs ≥1 social); everything else is Skip-for-now.
const STEPS: { key: StepKey; optional?: boolean }[] = [
  { key: "name" },
  { key: "ugc_before", optional: true },
  { key: "brands", optional: true },
  { key: "experience", optional: true },
  // Rhys 2026-07-21: questionnaire trimmed — one taxonomy question only (the
  // industries one, i.e. `niches`); `content_types` and `hours_per_week` dropped.
  { key: "niches", optional: true },
  { key: "socials" },
  { key: "portfolio", optional: true },   // "Add your best videos" — right after socials
  { key: "posts_per_day", optional: true },
  // Rhys 2026-07-23: birthday + gender merged into one "Age & Gender" step
  // (age is a dropdown now, not a date picker). Keeps the `birthday` key so
  // ProfileGate deep-links and the date_of_birth save path still resolve.
  { key: "birthday", optional: true },
  { key: "location", optional: true },
  { key: "how_heard", optional: true },
  { key: "whatsapp" },
  { key: "photo", optional: true },
  { key: "earnings" },
  { key: "done" },
];

// coarse sections for the clickable progress header
const SECTIONS: { label: string; first: StepKey }[] = [
  { label: "About you", first: "name" },
  { label: "Socials", first: "socials" },
  { label: "Details", first: "posts_per_day" },
  { label: "Finish", first: "earnings" },
];
const SECTION_STARTS = SECTIONS.map((s) => STEPS.findIndex((x) => x.key === s.first));

// Brands Lumina's creators work with (from luminaclippers.com), shown as social
// proof. Logos come from Clearbit by domain; the initials show only if a logo
// fails to load.
const LUMINA_BRANDS: { name: string; domain: string }[] = [
  { name: "OKX", domain: "okx.com" },
  { name: "Stake", domain: "stake.com" },
  { name: "Magic Eden", domain: "magiceden.io" },
  { name: "Polkadot", domain: "polkadot.com" },
  { name: "Adobe", domain: "adobe.com" },
  { name: "Midjourney", domain: "midjourney.com" },
  { name: "TikTok", domain: "tiktok.com" },
  { name: "Riverside", domain: "riverside.fm" },
  { name: "Wispr Flow", domain: "wisprflow.ai" },
  { name: "Caliente", domain: "caliente.mx" },
  { name: "Aviator", domain: "aviatorapp.io" },
  { name: "High Roller", domain: "highroller.com" },
  { name: "Forward", domain: "forward.com" },
  { name: "Humanity", domain: "humanity.com" },
];
const CONTENT_TYPES: { key: string; label: string; icon: string }[] = [
  { key: "unboxing", label: "Unboxing Videos", icon: "📦" },
  { key: "reviews", label: "Reviews & Testimonials", icon: "⭐" },
  { key: "demos", label: "Product Demos", icon: "▶️" },
  { key: "lifestyle", label: "Lifestyle Videos", icon: "🌤️" },
  { key: "ads", label: "Video Ads", icon: "🎥" },
  { key: "talking", label: "Talking Style Videos", icon: "🎙️" },
  { key: "faceless", label: "Faceless Content / Clipping", icon: "✂️" },
  { key: "technology", label: "Technology", icon: "💻" },
  { key: "fitness", label: "Fitness", icon: "🏋️" },
];
// Rhys 2026-07-21: the industries a creator wants to work for. Legacy keys from
// the old 12-option list still render (unselected) on existing profiles.
// Rhys 2026-07-23: unified category taxonomy (same keys/labels as lib/niches.tsx
// NICHES) so a creator's chosen industries line up with the Explore filters.
const NICHE_OPTIONS: { key: string; label: string; icon: string }[] = [
  { key: "sports_entertainment", label: "Sports & Entertainment", icon: "🎬" },
  { key: "finance_technology", label: "Finance & Technology", icon: "📈" },
  { key: "fashion_beauty", label: "Fashion & Beauty", icon: "👗" },
  { key: "mobile_apps", label: "Mobile Apps", icon: "📱" },
  { key: "casino_crypto", label: "Casino & Crypto", icon: "🎰" },
  { key: "health_wellness", label: "Health & Wellness", icon: "🧘" },
  { key: "reaction_content", label: "Reaction Based Content", icon: "😮" },
];
// Rhys 2026-07-23: removed LinkedIn; X reads as Twitter; AI → "AI Search".
const HOW_HEARD: { key: string; label: string }[] = [
  { key: "friend", label: "Friend or colleague" },
  { key: "google", label: "Google" },
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
  { key: "x", label: "Twitter" },
  { key: "ai", label: "AI Search" },
];

const CREATOR_TYPE_COPY: Record<CreatorType, { title: string; blurb: string; icon: string }> = {
  ugc: { title: "UGC creator", blurb: "I make content for brands to use in their own ads.", icon: "🎬" },
  influencer: { title: "Influencer", blurb: "I post to my own audience and drive engagement.", icon: "📣" },
  both: { title: "Both", blurb: "I create UGC and post to my own following.", icon: "✨" },
};
const GENDER_LABEL: Record<Gender, string> = { male: "Male", female: "Female", non_binary: "Non-binary", other: "Other", prefer_not_to_say: "Prefer not to say" };
const EDUCATION_LABEL: Record<EducationLevel, string> = {
  in_high_school: "In high school", in_college: "In college", graduated: "Graduated",
  grad_school: "Grad school", no_college: "Didn't go to college", na: "N/A",
};
const PAYOUT_LABEL: Record<PayoutMethod, string> = { paypal: "PayPal", solana: "Solana (wallet)", whop: "Whop" };
const PAYOUT_PLACEHOLDER: Record<PayoutMethod, string> = { paypal: "PayPal email", solana: "Solana wallet address", whop: "Whop username" };

const control =
  "min-h-11 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-base text-[var(--color-text)] outline-none transition focus-visible:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]";
const labelCls = "block text-sm font-medium text-[var(--color-text)]";

function resolveInitialStep(raw: string | null): number {
  if (!raw) return 0;
  // `gender` merged into the combined Age & Gender step (key "birthday"), so a
  // stale ?step=gender deep-link still resolves there instead of falling to step 0.
  const alias: Record<string, StepKey> = { personal: "name", social: "socials", socials: "socials", portfolio: "portfolio", payment: "payment", details: "birthday", gender: "birthday" };
  const key = (alias[raw] ?? raw) as StepKey;
  const i = STEPS.findIndex((s) => s.key === key);
  return i < 0 ? 0 : i;
}

// Age is chosen from a dropdown now (Rhys 2026-07-23), but the profile still
// stores date_of_birth, so map the chosen age to Jan 1 of the implied year.
const AGE_OPTIONS = Array.from({ length: 83 }, (_, i) => i + 18); // 18–100
function dobFromAge(age: number): string {
  return `${new Date().getFullYear() - age}-01-01`;
}
function ageFrom(dob: string): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = new Date();
  let age = t.getFullYear() - y;
  if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

export function OnboardingWizard() {
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();

  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => { setToken(getAuthToken()); setReady(true); setStep(resolveInitialStep(sp.get("step") ?? sp.get("tab"))); }, [sp]);
  const bearer = token ?? "";
  const enabled = ready && !!token;

  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => getProfile(bearer), enabled, retry: retryNonAuth, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnMount: false });
  const socialsQ = useQuery({ queryKey: ["socials"], queryFn: () => listSocials(bearer), enabled, retry: retryNonAuth });
  const portfolioQ = useQuery({ queryKey: ["portfolio"], queryFn: () => listPortfolio(bearer), enabled, retry: retryNonAuth });
  useEffect(() => { if (profileQ.isError) router.replace("/login"); }, [profileQ.isError, router]);

  // Lumina creators are all UGC/clippers — default the type so the backend
  // join-gate (needs creator_type) is satisfied without a separate "type" step.
  const [creatorType, setCreatorType] = useState<CreatorType | "">("ugc");
  const [details, setDetails] = useState({ display_name: "", bio: "", whatsapp: "" });
  const [audience, setAudience] = useState({ date_of_birth: "", gender: "", education: "", ethnicity: "", primary_language: "", country: "", city: "" });
  const [payout, setPayout] = useState({ method: "" as PayoutMethod | "", paypal: "", solana: "", whop: "" });
  const [socialForms, setSocialForms] = useState<Record<string, { handle: string; followers: string }>>({});
  const [niches, setNiches] = useState<string[]>([]);
  const [ob, setOb] = useState({ ugc_before: "", experience: "", content_types: [] as string[], posts_per_day: 3, hours_per_week: 10, how_heard: "" });
  const seeded = useRef(false);
  useEffect(() => {
    const d = profileQ.data;
    if (!d || seeded.current) return;
    seeded.current = true;
    setCreatorType((d.creator_type as CreatorType) || "ugc");
    setDetails({ display_name: d.display_name ?? "", bio: d.bio ?? "", whatsapp: d.whatsapp ?? "" });
    setAudience({
      date_of_birth: d.date_of_birth ?? "", gender: d.gender ?? "", education: d.education ?? "", ethnicity: d.ethnicity ?? "",
      primary_language: d.primary_language ?? "", country: d.country ?? "", city: d.city ?? "",
    });
    setPayout({
      method: (d.payout_method as PayoutMethod) ?? "",
      paypal: d.payout_paypal ?? (d.payout_method === "paypal" ? d.payout_address ?? "" : ""),
      solana: d.payout_solana ?? (d.payout_method === "solana" ? d.payout_address ?? "" : ""),
      whop: d.payout_whop ?? (d.payout_method === "whop" ? d.payout_address ?? "" : ""),
    });
    setNiches(d.niches ?? []);
    const o = (d.onboarding ?? {}) as Partial<typeof ob>;
    setOb({
      ugc_before: o.ugc_before ?? "", experience: o.experience ?? "",
      content_types: o.content_types ?? [], posts_per_day: o.posts_per_day ?? 3,
      hours_per_week: o.hours_per_week ?? 10, how_heard: o.how_heard ?? "",
    });
  }, [profileQ.data]);

  const saveM = useMutation({ mutationFn: (patch: ProfileIn) => updateProfile(bearer, patch), onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }) });
  const addSocialM = useMutation({
    mutationFn: (v: { platform: Platform; handle: string; follower_count: number }) => addSocial(bearer, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["socials"] }),
  });
  const delSocialM = useMutation({ mutationFn: (id: string) => deleteSocial(bearer, id), onSuccess: () => qc.invalidateQueries({ queryKey: ["socials"] }) });

  const goTo = (i: number) => { saveM.reset(); addSocialM.reset(); setStep(Math.max(0, Math.min(STEPS.length - 1, i))); };
  const next = () => goTo(step + 1);
  const back = () => goTo(step - 1);

  if (ready && !token)
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Please sign in</h1>
        <Link href="/login" className="text-[var(--color-brand)] underline">Go to sign in</Link>
      </main>
    );
  // Wait for socials + portfolio too — REQUIRED/gating reads them, and treating
  // a still-loading query as empty would briefly (or, on error, permanently)
  // lock sections a completed creator has already finished.
  if (!ready || profileQ.isLoading || socialsQ.isLoading || portfolioQ.isLoading || !seeded.current)
    return (
      <main className="mx-auto max-w-xl px-6 py-12 space-y-4">
        <Skeleton className="h-2 w-full" /><Skeleton className="mt-8 h-9 w-72" /><Skeleton className="h-64 w-full" />
      </main>
    );

  const socials = socialsQ.data ?? [];
  const portfolio = portfolioQ.data ?? [];
  const cur = STEPS[step];

  // Required steps can't be skipped and gate the Continue button until valid.
  // Mandatory to complete the profile (no skip), mirroring the backend
  // apply-gate: creator type (About), Instagram + TikTok verified (Socials), and
  // at least one video (Videos). Name, birthday, other details, and payment are
  // all optional during onboarding.
  // Profile-completion gate: socials + creator-type are what the backend join
  // gate needs (≥1 social + creator_type), so they're the required steps here.
  // Portfolio is optional now (the reduced no-friction flow).
  const REQUIRED: Partial<Record<StepKey, boolean>> = {
    // Display name is the first thing brands see — don't let it be left blank.
    name: details.display_name.trim().length > 0,
    // A random unverified Instagram/TikTok handle must NOT satisfy the gate — those
    // platforms have a bio-code verification, so they only count once verified.
    // YouTube/X/Facebook are self-reported (no verification mechanism) and count as-is.
    socials: socials.some((s) => s.is_verified || ["youtube", "twitter", "facebook"].includes(s.platform)),
    type: !!creatorType,
    // Reece: WhatsApp number is mandatory — no skip, can't continue without a
    // real number (dial code + national digits, ≥8 digits total).
    whatsapp: details.whatsapp.replace(/\D/g, "").length >= 8,
  };
  const stepRequired = cur.key in REQUIRED;
  const canContinue = !stepRequired || !!REQUIRED[cur.key];
  const isLast = step === STEPS.length - 1;
  const curSection = SECTION_STARTS.reduce((acc, start, i) => (step >= start ? i : acc), 0);

  // Step-gating: you can't jump ahead past an unfinished required step. The
  // furthest reachable step is the first incomplete required one (you can sit
  // on it to finish it); everything after stays locked. Going back is allowed.
  const stepOk = (key: StepKey) => !(key in REQUIRED) || !!REQUIRED[key];
  const firstIncomplete = STEPS.findIndex((s) => s.key in REQUIRED && !REQUIRED[s.key]);
  const maxReachable = firstIncomplete === -1 ? STEPS.length - 1 : firstIncomplete;
  const sectionEnd = (i: number) => (i + 1 < SECTION_STARTS.length ? SECTION_STARTS[i + 1] : STEPS.length);
  const sectionHasRequired = (i: number) => STEPS.slice(SECTION_STARTS[i], sectionEnd(i)).some((s) => s.key in REQUIRED);
  const sectionComplete = (i: number) => STEPS.slice(SECTION_STARTS[i], sectionEnd(i)).every((s) => stepOk(s.key));
  const sectionLocked = (i: number) => SECTION_STARTS[i] > maxReachable;
  const err = saveM.isError ? (saveM.error as Error).message : addSocialM.isError ? (addSocialM.error as Error).message : "";
  const committing = saveM.isPending || addSocialM.isPending;

  async function onContinue() {
    try {
      const k = cur.key;
      if (k === "type") await saveM.mutateAsync({ creator_type: creatorType || undefined });
      // Name is step 1 — persist creator_type here too (no separate type step now).
      else if (k === "name") await saveM.mutateAsync({ display_name: details.display_name || undefined, creator_type: creatorType || "ugc" });
      else if (k === "bio") await saveM.mutateAsync({ bio: details.bio || undefined });
      else if (k === "whatsapp") await saveM.mutateAsync({ whatsapp: details.whatsapp || undefined });
      // Combined Age & Gender step saves both (the separate gender step is gone).
      else if (k === "birthday") await saveM.mutateAsync({ date_of_birth: audience.date_of_birth || undefined, gender: (audience.gender || undefined) as Gender | undefined });
      else if (k === "education") await saveM.mutateAsync({ education: (audience.education || undefined) as EducationLevel | undefined });
      else if (k === "ethnicity") await saveM.mutateAsync({ ethnicity: audience.ethnicity || undefined });
      else if (k === "language") await saveM.mutateAsync({ primary_language: audience.primary_language || undefined });
      else if (k === "location") await saveM.mutateAsync({ country: audience.country || undefined, city: audience.city || undefined });
      else if (k === "payment") await saveM.mutateAsync({ payout_method: (payout.method || undefined) as PayoutMethod | undefined, payout_paypal: payout.paypal || undefined, payout_solana: payout.solana || undefined, payout_whop: payout.whop || undefined });
      else if (k === "niches") await saveM.mutateAsync({ niches });
      else if (k === "ugc_before") await saveM.mutateAsync({ onboarding: { ugc_before: ob.ugc_before || undefined } });
      else if (k === "experience") await saveM.mutateAsync({ onboarding: { experience: ob.experience || undefined } });
      else if (k === "content_types") await saveM.mutateAsync({ onboarding: { content_types: ob.content_types } });
      else if (k === "posts_per_day") await saveM.mutateAsync({ onboarding: { posts_per_day: ob.posts_per_day } });
      else if (k === "hours_per_week") await saveM.mutateAsync({ onboarding: { hours_per_week: ob.hours_per_week } });
      else if (k === "how_heard") await saveM.mutateAsync({ onboarding: { how_heard: ob.how_heard || undefined } });
      // "socials" saves inline per-platform; "brands"/"testimonial"/"earnings"
      // are informational — nothing to persist on Continue.
      next();
    } catch { /* err surfaced below */ }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {/* progress: thin bar + section pills + step counter */}
      <div className="mb-9">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
          <div className="h-full rounded-full bg-[var(--color-brand)] transition-all duration-300" style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {SECTIONS.map((s, i) => {
              const locked = sectionLocked(i);
              const done = sectionHasRequired(i) && sectionComplete(i);
              return (
                <button
                  key={s.label}
                  type="button"
                  disabled={locked}
                  onClick={() => { if (!locked) goTo(SECTION_STARTS[i]); }}
                  title={locked ? "Finish the required steps first" : undefined}
                  className={`rounded-full px-4 py-2.5 text-base transition ${
                    locked
                      ? "cursor-not-allowed text-[var(--color-text-muted)] opacity-40"
                      : i === curSection
                        ? "cursor-pointer bg-[var(--color-brand)]/15 font-semibold text-[var(--color-brand-soft)]"
                        : "cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {done ? (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : locked ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><rect x="4" y="10" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M8 10V7a4 4 0 018 0v3" stroke="currentColor" strokeWidth="2" /></svg>
                    ) : null}
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="min-h-[340px]">
        {cur.key === "ugc_before" ? (
          <StepShell eyebrow="Your background" title="Have you done UGC work before?" sub="This helps us personalize your onboarding path.">
            <div className="grid gap-2">
              <OptionCard selected={ob.ugc_before === "yes"} onClick={() => setOb({ ...ob, ugc_before: "yes" })} icon="✅" title="Yes, I've created for brands" />
              <OptionCard selected={ob.ugc_before === "no"} onClick={() => setOb({ ...ob, ugc_before: "no" })} icon="✨" title="No, I'm just getting started" />
            </div>
          </StepShell>
        ) : null}

        {cur.key === "experience" ? (
          <StepShell eyebrow="Your background" title="How much experience do you have with UGC campaigns?">
            <div className="grid gap-2">
              {[["getting_started", "I'm just getting started"], ["few", "I've done a few campaigns"], ["seasoned", "I'm a seasoned creator"]].map(([k, label]) => (
                <OptionCard key={k} selected={ob.experience === k} onClick={() => setOb({ ...ob, experience: k })} icon="⭐" title={label} />
              ))}
            </div>
          </StepShell>
        ) : null}

        {cur.key === "brands" ? (
          <StepShell eyebrow="The opportunity" title={`${(details.display_name || "").trim().split(" ")[0] || "You"}, you could work with these brands!`} sub="Join Lumina creators already working with top brands.">
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
              {LUMINA_BRANDS.map((b) => (
                <div key={b.name} className="flex flex-col items-center gap-1.5">
                  <BrandLogo name={b.name} domain={b.domain} />
                  <span className="text-center text-[10px] leading-tight text-[var(--color-text-muted)]">{b.name}</span>
                </div>
              ))}
            </div>
          </StepShell>
        ) : null}

        {cur.key === "content_types" ? (
          <StepShell eyebrow="Your craft" title="What type of content do you like to make?" sub="Select all that apply.">
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map((c) => {
                const on = ob.content_types.includes(c.key);
                return (
                  <button key={c.key} onClick={() => setOb({ ...ob, content_types: on ? ob.content_types.filter((x) => x !== c.key) : [...ob.content_types, c.key] })}
                    className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm transition ${on ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "card-grad text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}>
                    <span aria-hidden>{c.icon}</span>{c.label}
                  </button>
                );
              })}
            </div>
          </StepShell>
        ) : null}

        {cur.key === "niches" ? (
          <StepShell eyebrow="Your craft" title="What industries do you want to create for?" sub="Select up to 5.">
            <div className="flex flex-wrap gap-2">
              {NICHE_OPTIONS.map((n) => {
                const on = niches.includes(n.key);
                const full = niches.length >= 5 && !on;
                return (
                  <button key={n.key} disabled={full} onClick={() => setNiches(on ? niches.filter((x) => x !== n.key) : [...niches, n.key])}
                    className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm transition disabled:opacity-40 ${on ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "card-grad text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}>
                    <span aria-hidden>{n.icon}</span>{n.label}
                  </button>
                );
              })}
            </div>
          </StepShell>
        ) : null}

        {cur.key === "posts_per_day" ? (
          <StepShell eyebrow="Your capacity" title="How many videos can you create per day?">
            <div className="text-center">
              <p className="tabular text-5xl font-semibold text-[var(--color-text)]">{ob.posts_per_day}</p>
              <p className="text-[var(--color-text-secondary)]">video{ob.posts_per_day === 1 ? "" : "s"}</p>
              <input type="range" min={1} max={10} value={ob.posts_per_day} onChange={(e) => setOb({ ...ob, posts_per_day: Number(e.target.value) })}
                className="mt-6 w-full accent-[var(--color-brand)]" />
            </div>
          </StepShell>
        ) : null}

        {cur.key === "hours_per_week" ? (
          <StepShell eyebrow="Your capacity" title="How many hours per week can you dedicate?" sub="We'll find campaigns that fit your schedule.">
            <div className="text-center">
              <p className="tabular text-5xl font-semibold text-[var(--color-text)]">{ob.hours_per_week}</p>
              <p className="text-[var(--color-text-secondary)]">hours</p>
              <input type="range" min={1} max={40} value={ob.hours_per_week} onChange={(e) => setOb({ ...ob, hours_per_week: Number(e.target.value) })}
                className="mt-6 w-full accent-[var(--color-brand)]" />
            </div>
          </StepShell>
        ) : null}

        {cur.key === "how_heard" ? (
          <StepShell eyebrow="Last thing" title="How did you hear about us?" sub="Optional, but helpful if someone invited or referred you.">
            <div className="grid gap-2">
              {HOW_HEARD.map((h) => (
                <OptionCard key={h.key} compact selected={ob.how_heard === h.key} onClick={() => setOb({ ...ob, how_heard: h.key })} title={h.label} />
              ))}
            </div>
          </StepShell>
        ) : null}

        {cur.key === "whatsapp" ? (
          <StepShell eyebrow="Private Campaign Manager" title="WhatsApp Number" sub="So the Lumina team can reach you fast & get you more paid gigs.">
            <WhatsAppInput value={details.whatsapp} onChange={(v) => setDetails({ ...details, whatsapp: v })} />
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">Your WhatsApp number is required to continue.</p>
          </StepShell>
        ) : null}

        {cur.key === "testimonial" ? (
          <StepShell eyebrow="You're in good company" title="Join thousands of trusted creators">
            <div className="card-lumina rounded-[var(--radius-card)] p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--color-brand)]/15 text-lg font-semibold text-[var(--color-brand-soft)]">D</span>
                <div>
                  <p className="font-semibold text-[var(--color-text)]">Darah E.</p>
                  <p className="text-[var(--color-brand-soft)]">★★★★★</p>
                </div>
              </div>
              <p className="mt-4 text-[var(--color-text-secondary)]">
                &ldquo;I&apos;ve been using Lumina for about 6 months and it changed how I think about content. I get to work with cool brands on my own schedule. The best part is you don&apos;t need a big following to get started.&rdquo;
              </p>
            </div>
          </StepShell>
        ) : null}

        {cur.key === "earnings" ? (
          <StepShell eyebrow="What's possible" title="Your earnings potential">
            <div className="rounded-[var(--radius-card)] bg-[var(--color-brand)]/10 p-6 text-center ring-1 ring-[var(--color-brand)]/30">
              <p className="tabular text-4xl font-semibold text-[var(--color-brand-soft)]">$5,500</p>
              <p className="text-sm text-[var(--color-text-secondary)]">per month</p>
            </div>
            <div className="mt-4 grid gap-2">
              {[["💼", "Get paid for brand campaigns"], ["🏆", "Earn weekly leaderboard bonuses"], ["📈", "Rank up to unlock higher payouts"]].map(([icon, label]) => (
                <div key={label} className="card-grad flex items-center gap-3 rounded-[var(--radius-card)] px-4 py-3">
                  <span aria-hidden>{icon}</span><span className="text-sm text-[var(--color-text)]">{label}</span>
                </div>
              ))}
            </div>
          </StepShell>
        ) : null}

        {cur.key === "type" ? (
          <StepShell eyebrow="Welcome to Lumina" title="What kind of creator are you?" sub="This helps us match you to the right campaigns. You can change it anytime.">
            <div className="grid gap-3">
              {CREATOR_TYPES.map((t) => (
                <OptionCard key={t} selected={creatorType === t} onClick={() => setCreatorType(t)} icon={CREATOR_TYPE_COPY[t].icon} title={CREATOR_TYPE_COPY[t].title} blurb={CREATOR_TYPE_COPY[t].blurb} />
              ))}
            </div>
          </StepShell>
        ) : null}

        {cur.key === "name" ? (
          <StepShell eyebrow="About you" title="What should we call you?" sub="Your name or handle — this is what brands see first.">
            <Field label="Display name" placeholder="e.g. Alex Rivera" value={details.display_name} onChange={(e) => setDetails({ ...details, display_name: e.target.value })} autoFocus />
          </StepShell>
        ) : null}

        {cur.key === "photo" ? (
          <StepShell eyebrow="About you" title="Add a profile photo" sub="A face (or logo) makes your profile far more likely to get picked.">
            <AvatarPicker bearer={bearer} avatarUrl={profileQ.data?.avatar_url ?? null} onSaved={() => qc.invalidateQueries({ queryKey: ["profile"] })} />
          </StepShell>
        ) : null}

        {cur.key === "bio" ? (
          <StepShell eyebrow="About you" title="Write a short bio" sub="One or two sentences on the content you make.">
            <textarea rows={4} className={control + " py-2"} placeholder="I make punchy skincare UGC and product demos…" value={details.bio} onChange={(e) => setDetails({ ...details, bio: e.target.value })} />
          </StepShell>
        ) : null}

        {cur.key === "socials" ? (
          <StepShell eyebrow="Your reach" title="Your social accounts" sub="Add the platforms you're on so brands can see your reach. Instagram and TikTok get a verified badge.">
            <SocialsTabbed
              bearer={bearer}
              socials={socials}
              socialForms={socialForms}
              setSocialForms={setSocialForms}
              onAdd={(platform, handle, followers) => addSocialM.mutate({ platform, handle, follower_count: followers })}
              onRemove={(id) => delSocialM.mutate(id)}
              onChanged={() => qc.invalidateQueries({ queryKey: ["socials"] })}
            />
          </StepShell>
        ) : null}

        {cur.key === "portfolio" ? (
          <StepShell eyebrow="Show your work" title="Upload your best videos" sub="Brands watch these when matching campaigns to you. Showcase clips — separate from campaign submissions.">
            <PortfolioStep bearer={bearer} portfolio={portfolio} onChanged={() => qc.invalidateQueries({ queryKey: ["portfolio"] })} />
          </StepShell>
        ) : null}

        {cur.key === "birthday" ? (
          <StepShell eyebrow="A few details" title="Your Age & Gender" sub="Brands use this to match you to the right campaigns. Kept private.">
            <div className="max-w-xs space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">Age</label>
                <Select
                  ariaLabel="Age"
                  placeholder="Select your age"
                  value={ageFrom(audience.date_of_birth)?.toString() ?? ""}
                  onChange={(v) => setAudience({ ...audience, date_of_birth: v ? dobFromAge(Number(v)) : "" })}
                  options={AGE_OPTIONS.map((a) => ({ value: a.toString(), label: a.toString() }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">Gender</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["male", "female"] as Gender[]).map((g) => (
                    <OptionCard key={g} compact selected={audience.gender === g} onClick={() => setAudience({ ...audience, gender: g })} title={GENDER_LABEL[g]} />
                  ))}
                </div>
              </div>
            </div>
          </StepShell>
        ) : null}

        {cur.key === "education" ? (
          <StepShell eyebrow="A few details" title="Where are you in your education?" sub="Optional — some campaigns target students or grads.">
            <div className="grid gap-2">
              {EDUCATION_LEVELS.map((e) => (
                <OptionCard key={e} compact selected={audience.education === e} onClick={() => setAudience({ ...audience, education: e })} title={EDUCATION_LABEL[e]} />
              ))}
            </div>
          </StepShell>
        ) : null}

        {cur.key === "ethnicity" ? (
          <StepShell eyebrow="A few details" title="How would you describe your ethnicity?" sub="Optional — helps match campaigns looking for specific representation.">
            <Field label="Ethnicity" placeholder="e.g. Latina, South Asian, Mixed…" value={audience.ethnicity} onChange={(e) => setAudience({ ...audience, ethnicity: e.target.value })} />
          </StepShell>
        ) : null}

        {cur.key === "language" ? (
          <StepShell eyebrow="A few details" title="What language do you create in?" sub="Your primary content language.">
            <Field label="Primary language" placeholder="e.g. English" value={audience.primary_language} onChange={(e) => setAudience({ ...audience, primary_language: e.target.value })} />
          </StepShell>
        ) : null}

        {cur.key === "location" ? (
          <StepShell eyebrow="A few details" title="Where are you located?" sub="Helps us match you with local brands. Pick your city from the list.">
            <LocationAutocomplete
              country={audience.country}
              city={audience.city}
              onPick={(country, city) => setAudience({ ...audience, country, city })}
            />
          </StepShell>
        ) : null}

        {cur.key === "payment" ? (
          <StepShell eyebrow="Getting paid" title="Where should we send your earnings?" sub="Set this before you request a payout. Each method keeps its own details.">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {PAYOUT_METHODS.map((m) => (
                  <button key={m} onClick={() => setPayout({ ...payout, method: payout.method === m ? "" : m })}
                    className={`cursor-pointer rounded-full px-4 py-2 text-sm transition ${payout.method === m ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}>
                    {PAYOUT_LABEL[m]}
                  </button>
                ))}
              </div>
              {payout.method ? (
                <div className="space-y-2">
                  <label className={labelCls}>{PAYOUT_LABEL[payout.method as PayoutMethod]} details</label>
                  <input className={control} placeholder={PAYOUT_PLACEHOLDER[payout.method as PayoutMethod]} value={payout[payout.method as PayoutMethod]} onChange={(e) => setPayout({ ...payout, [payout.method as PayoutMethod]: e.target.value } as typeof payout)} />
                </div>
              ) : null}
            </div>
          </StepShell>
        ) : null}

        {cur.key === "done" ? (
          <DoneStep name={(profileQ.data?.display_name ?? "").trim().split(" ")[0] || "creator"} hasType={!!creatorType} socialCount={socials.length} portfolioCount={portfolio.length} hasPayout={!!payout.method} campaignNext={sp.get("next") || "/dashboard"} />
        ) : null}
      </div>

      {err ? <p className="mt-4 text-sm text-[var(--color-danger)]">{err}</p> : null}

      {!isLast ? (
        <div className="mt-8 flex items-center justify-between gap-3">
          <button onClick={back} disabled={step === 0} className="min-h-11 cursor-pointer rounded-full border border-[var(--color-border)] px-5 py-2.5 text-[15px] font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)] disabled:invisible">← Back</button>
          <div className="flex items-center gap-3">
            {cur.optional && !stepRequired ? <button onClick={next} className="min-h-11 cursor-pointer px-3 text-[15px] font-medium text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]">Skip for now</button> : null}
            <div className="w-40"><Button loading={committing} disabled={!canContinue} onClick={onContinue}>Continue</Button></div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function StepShell({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">{eyebrow}</p>
      <h1 className="mt-2.5 text-4xl font-semibold tracking-tight text-[var(--color-text)]">{title}</h1>
      {sub ? <p className="mt-3 text-lg text-[var(--color-text-secondary)]">{sub}</p> : null}
      <div className="mt-7">{children}</div>
    </div>
  );
}

// Common WhatsApp dial codes (flag emoji + code). Enough coverage for onboarding;
// the value stored is the full E.164-ish string ("+<code><number>") which powers
// the admin's one-click WhatsApp button (wa.me/<digits>).
const DIAL_CODES: { flag: string; code: string; label: string }[] = [
  { flag: "🇺🇸", code: "+1", label: "US/CA" }, { flag: "🇬🇧", code: "+44", label: "UK" },
  { flag: "🇦🇺", code: "+61", label: "AU" }, { flag: "🇧🇩", code: "+880", label: "BD" },
  { flag: "🇮🇳", code: "+91", label: "IN" }, { flag: "🇵🇰", code: "+92", label: "PK" },
  { flag: "🇳🇬", code: "+234", label: "NG" }, { flag: "🇿🇦", code: "+27", label: "ZA" },
  { flag: "🇲🇽", code: "+52", label: "MX" }, { flag: "🇧🇷", code: "+55", label: "BR" },
  { flag: "🇩🇪", code: "+49", label: "DE" }, { flag: "🇫🇷", code: "+33", label: "FR" },
  { flag: "🇪🇸", code: "+34", label: "ES" }, { flag: "🇮🇹", code: "+39", label: "IT" },
  { flag: "🇳🇱", code: "+31", label: "NL" }, { flag: "🇦🇪", code: "+971", label: "AE" },
  { flag: "🇸🇦", code: "+966", label: "SA" }, { flag: "🇵🇭", code: "+63", label: "PH" },
  { flag: "🇮🇩", code: "+62", label: "ID" }, { flag: "🇪🇬", code: "+20", label: "EG" },
  { flag: "🇰🇪", code: "+254", label: "KE" }, { flag: "🇹🇷", code: "+90", label: "TR" },
  { flag: "🇦🇷", code: "+54", label: "AR" }, { flag: "🇨🇴", code: "+57", label: "CO" },
  { flag: "🇵🇹", code: "+351", label: "PT" }, { flag: "🇵🇱", code: "+48", label: "PL" },
];

// Worldwide location typeahead (Rhys rev4). Queries the open Photon geocoder
// CLIENT-SIDE (the user's browser, so Render's egress IP is never involved and
// there are no server rate limits), debounced. Picking a result fills the real
// country + city the backend stores.
type PlaceHit = { label: string; city: string; country: string };
function LocationAutocomplete({
  country, city, onPick,
}: {
  country: string; city: string; onPick: (country: string, city: string) => void;
}) {
  const [q, setQ] = useState(city && country ? `${city}, ${country}` : city || country || "");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(term)}&limit=6&layer=city&layer=state&layer=country`);
        const data = await r.json();
        if (cancelled) return;
        const seen = new Set<string>();
        const parsed: PlaceHit[] = (data.features ?? []).map((f: { properties?: Record<string, string> }) => {
          const p = f.properties ?? {};
          const city = p.name ?? p.city ?? "";
          const countryName = p.country ?? "";
          const region = p.state ?? "";
          const label = [city, region && region !== city ? region : "", countryName].filter(Boolean).join(", ");
          return { label, city, country: countryName };
        }).filter((h: PlaceHit) => h.label && h.country && !seen.has(h.label) && seen.add(h.label));
        setHits(parsed);
      } catch { if (!cancelled) setHits([]); }
      finally { if (!cancelled) setLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={boxRef} className="relative max-w-lg">
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search your city or country…"
        className="min-h-12 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-[15px] text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
        autoComplete="off"
      />
      {open && (q.trim().length >= 2) ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-bg-deep)] shadow-2xl">
          {loading && hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--color-text-muted)]">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--color-text-muted)]">No matches — keep typing.</p>
          ) : (
            hits.map((h) => (
              <button
                key={h.label}
                type="button"
                onClick={() => { onPick(h.country, h.city || h.country); setQ(h.label); setOpen(false); }}
                className="block w-full cursor-pointer px-4 py-2.5 text-left text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
              >
                {h.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function WhatsAppInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Split an existing "+<code><number>" back into code + national number so the
  // field re-hydrates on edit. Longest matching dial code wins.
  const match = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length).find((d) => value.startsWith(d.code));
  const [code, setCode] = useState(match?.code ?? "+1");
  const [num, setNum] = useState(match ? value.slice(match.code.length).trim() : value.replace(/^\+/, ""));
  const compose = (c: string, n: string) => onChange(n.trim() ? `${c}${n.replace(/[^\d]/g, "")}` : "");
  return (
    <div className="flex max-w-md items-stretch gap-2">
      <select
        value={code}
        onChange={(e) => { setCode(e.target.value); compose(e.target.value, num); }}
        className="min-h-12 shrink-0 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-[15px] text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
        aria-label="Country code"
      >
        {DIAL_CODES.map((d) => <option key={d.code + d.label} value={d.code}>{d.flag} {d.code}</option>)}
      </select>
      <input
        type="tel"
        inputMode="tel"
        value={num}
        onChange={(e) => { setNum(e.target.value); compose(code, e.target.value); }}
        placeholder="WhatsApp number"
        className="min-h-12 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-[15px] text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
      />
    </div>
  );
}

// A brand's real logo on a white chip so colored marks read well. Tries the
// DuckDuckGo icon service, then Google's favicon service (covers a few DDG
// misses like Adobe), then falls back to the brand's initials.
function BrandLogo({ name, domain }: { name: string; domain: string }) {
  // Google's favicon service is the logo source (Clearbit's free logo API was
  // shut down post-HubSpot and now DNS-fails, spamming the console on every
  // brand — dropped). A valid-but-blank favicon for niche domains is caught by
  // the onLoad naturalWidth guard below → falls through to initials.
  const sources = [
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
  ];
  const [idx, setIdx] = useState(0);
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (idx >= sources.length) {
    return (
      <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-surface-2)] text-base font-bold text-[var(--color-brand-soft)] ring-1 ring-[var(--color-border)]">
        {initials}
      </span>
    );
  }
  return (
    <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-white ring-1 ring-[var(--color-border)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sources[idx]}
        alt={name}
        loading="lazy"
        onError={() => setIdx((i) => i + 1)}
        onLoad={(e) => { if ((e.currentTarget.naturalWidth || 0) <= 16) setIdx((i) => i + 1); }}
        className="h-9 w-9 object-contain"
      />
    </span>
  );
}

function OptionCard({ selected, onClick, title, blurb, icon, compact }: { selected: boolean; onClick: () => void; title: string; blurb?: string; icon?: string; compact?: boolean }) {
  return (
    <button onClick={onClick}
      className={`card-grad flex items-center gap-4 rounded-[var(--radius-card)] text-left transition ${compact ? "px-4 py-3" : "p-4"} ${selected ? "ring-2 ring-[var(--color-brand)]" : "hover:ring-1 hover:ring-[var(--color-border)]"}`}>
      {icon ? <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-2)] text-xl">{icon}</span> : null}
      <span className="min-w-0">
        <span className="block font-semibold text-[var(--color-text)]">{title}</span>
        {blurb ? <span className="block text-sm text-[var(--color-text-secondary)]">{blurb}</span> : null}
      </span>
      <span className={`ml-auto grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ${selected ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "border border-[var(--color-border)]"}`}>{selected ? "✓" : ""}</span>
    </button>
  );
}

const VERIFIABLE_PLATFORMS: Platform[] = ["instagram", "tiktok"];

// A social row worth showing in the "already added" list: Instagram/TikTok only
// once the bio code has been confirmed (before that it's a verification
// placeholder, not an account); everything else is self-reported so it counts
// the moment it's added.
const settled = (s: { platform: string; is_verified: boolean }) =>
  s.is_verified || !VERIFIABLE_PLATFORMS.includes(s.platform as Platform);

// Rev2 #2: one Socials view with platform tabs — click a platform, see (and add)
// that platform's account. Replaces the five Continue-per-platform steps.
function SocialsTabbed({ bearer, socials, socialForms, setSocialForms, onAdd, onRemove, onChanged }: {
  bearer: string;
  socials: { id: string; platform: string; handle: string; follower_count: number | null; is_verified: boolean }[];
  socialForms: Record<string, { handle: string; followers: string }>;
  setSocialForms: (f: Record<string, { handle: string; followers: string }>) => void;
  onAdd: (platform: Platform, handle: string, followers: number) => void;
  onRemove: (id: string) => void;
  onChanged: () => void;
}) {
  const [active, setActive] = useState<Platform>("instagram");
  return (
    <div className="space-y-5">
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto rounded-full bg-[var(--color-surface)] p-1">
        {SOCIAL_PLATFORMS.map((p) => {
          const has = socials.some((s) => s.platform === p);
          const on = active === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setActive(p)}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                on ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
            >
              <PlatformIcon name={p} className="h-4 w-4" />
              <span>{platformLabel(p)}</span>
              {has ? <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-[var(--color-on-brand)]" : "bg-[var(--color-brand)]"}`} /> : null}
            </button>
          );
        })}
      </div>

      {/* Every account already added on this platform — remove any, add more.
          Rhys 2026-07-21: on Instagram/TikTok, `Get verification code` creates a
          placeholder row server-side. Showing it made the account appear to "add
          and then remove" (and read `0 followers`), so only settled accounts are
          listed here — verifiable platforms once verified, the rest immediately. */}
      {socials.filter((s) => s.platform === active && settled(s)).length > 0 ? (
        <div className="space-y-2">
          {socials.filter((s) => s.platform === active && settled(s)).map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                {a.is_verified ? <CheckBadge /> : null}
                @{a.handle} · <span className="tabular text-[var(--color-text-secondary)]">{a.follower_count == null ? "Unknown" : a.follower_count.toLocaleString()}</span> followers
                {a.is_verified ? <span className="rounded-full bg-[var(--color-brand)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--color-brand)]">Verified</span> : null}
              </span>
              <button className="cursor-pointer text-xs text-[var(--color-danger)]" onClick={() => onRemove(a.id)}>Remove</button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Add / verify ANOTHER account on this platform (Bill: support >1 per platform). */}
      <div className="space-y-2">
        {socials.some((s) => s.platform === active && settled(s)) ? (
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">Add another {platformLabel(active)} account</p>
        ) : null}
        <SocialStep
          // Keyed on the platform only. Keying on the account count remounted the
          // step the instant a verification placeholder landed, destroying the
          // freshly-issued code panel — the "adds and then removes" flicker.
          key={`add-${active}`}
          platform={active}
          bearer={bearer}
          existing={undefined}
          form={socialForms[active] ?? { handle: "", followers: "" }}
          onForm={(f) => setSocialForms({ ...socialForms, [active]: f })}
          onAdd={onAdd}
          onRemove={onRemove}
          onChanged={onChanged}
        />
      </div>
    </div>
  );
}

function SocialStep({ platform, bearer, existing, form, onForm, onAdd, onRemove, onChanged }: {
  platform: Platform;
  bearer: string;
  existing?: { id: string; handle: string; follower_count: number | null; is_verified: boolean };
  form: { handle: string; followers: string };
  onForm: (f: { handle: string; followers: string }) => void;
  onAdd?: (platform: Platform, handle: string, followers: number) => void;
  onRemove: (id: string) => void;
  onChanged: () => void;
}) {
  const verifiable = VERIFIABLE_PLATFORMS.includes(platform);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const startM = useMutation({
    // `force` = the "New code" button: always mint a fresh code (the plain
    // "Get verification code" reuses a still-valid one, which made "New code"
    // look like it did nothing).
    mutationFn: (force?: boolean) => startSocialVerify(bearer, platform, form.handle.trim(), !!force),
    // No onChanged() here: refetching mid-flow surfaced the server-side
    // verification placeholder as a real account row. One click, one panel.
    onSuccess: (r) => setCode(r.code),
  });
  const confirmM = useMutation({
    mutationFn: () => confirmSocialVerify(bearer, platform, form.handle.trim()),
    onSuccess: () => { setCode(null); onForm({ handle: "", followers: "" }); onChanged(); },
  });
  const err = startM.isError ? (startM.error as Error).message
    : confirmM.isError ? (confirmM.error as Error).message : "";

  const copy = async () => {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-text)]"><PlatformIcon name={platform} className="h-6 w-6" /></span>
        <span className="text-lg font-semibold text-[var(--color-text)]">{platformLabel(platform)}</span>
      </div>

      {existing && existing.is_verified ? (
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-btn)] border border-[var(--color-brand)]/40 bg-[var(--color-brand)]/5 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <CheckBadge />
            @{existing.handle} · <span className="tabular text-[var(--color-text-secondary)]">{existing.follower_count == null ? "Unknown" : existing.follower_count.toLocaleString()}</span> followers
            <span className="rounded-full bg-[var(--color-brand)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--color-brand)]">Verified</span>
          </span>
          <button className="cursor-pointer text-xs text-[var(--color-danger)]" onClick={() => onRemove(existing.id)}>Remove</button>
        </div>
      ) : !verifiable ? (
        // youtube / x / facebook: self-reported handle + followers (no bio verify)
        existing ? (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
            <span className="text-sm text-[var(--color-text)]">@{existing.handle} · <span className="tabular text-[var(--color-text-secondary)]">{existing.follower_count == null ? "Unknown" : existing.follower_count.toLocaleString()}</span> followers</span>
            <button className="cursor-pointer text-xs text-[var(--color-danger)]" onClick={() => onRemove(existing.id)}>Remove</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input className={control} placeholder="handle (without @)" value={form.handle} onChange={(e) => onForm({ ...form, handle: e.target.value })} />
              <input className={control} type="number" placeholder="follower count" value={form.followers} onChange={(e) => onForm({ ...form, followers: e.target.value })} />
            </div>
            <button
              type="button"
              disabled={!form.handle.trim() || !onAdd}
              onClick={() => { if (onAdd && form.handle.trim()) { onAdd(platform, form.handle.trim(), Number(form.followers) || 0); onForm({ handle: "", followers: "" }); } }}
              className="min-h-11 w-full cursor-pointer rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:opacity-50"
            >
              Add account
            </button>
          </div>
        )
      ) : (
        // instagram / tiktok: bio-code verification
        <div className="space-y-3">
          <div className="flex items-center overflow-hidden rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)]">
            <span className="pl-3 pr-1 text-[var(--color-text-muted)]">@</span>
            <input
              className="min-h-11 flex-1 bg-transparent px-1 text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
              placeholder={platform === "tiktok" ? "your username (e.g. joyjoy860)" : "your username"}
              value={form.handle}
              onChange={(e) => { onForm({ ...form, handle: e.target.value }); if (code) setCode(null); }}
            />
          </div>
          {/* The #1 verification failure: creators type their DISPLAY NAME. The
              scraper needs the exact username from the profile URL. */}
          <p className="text-xs text-[var(--color-text-muted)]">
            Use your exact {platformLabel(platform)} username from your profile link
            ({platform === "tiktok" ? "tiktok.com/@username" : "instagram.com/username"}) — not your display name.
          </p>

          {!code ? (
            <button
              disabled={!form.handle.trim() || startM.isPending}
              onClick={() => startM.mutate(false)}
              className="min-h-11 w-full rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:opacity-50"
            >
              {startM.isPending ? "Getting your code…" : "Get verification code"}
            </button>
          ) : (
            <div className="space-y-3 rounded-[var(--radius-card)] border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/5 p-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Add this code anywhere in your {platformLabel(platform)} bio, then tap Verify. You can remove it after.
              </p>
              <div className="flex items-center gap-2">
                <code className="tabular flex-1 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-bg-deep)] px-3 py-2 text-lg font-semibold tracking-wider text-[var(--color-brand)]">{code}</code>
                <button onClick={copy} className="min-h-11 rounded-full border border-[var(--color-border)] px-4 text-sm text-[var(--color-text)] transition hover:border-[var(--color-brand)]">{copied ? "Copied" : "Copy"}</button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={confirmM.isPending}
                  onClick={() => confirmM.mutate()}
                  className="min-h-11 flex-1 rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:opacity-50"
                >
                  {confirmM.isPending ? "Checking your bio…" : "Verify"}
                </button>
                <button disabled={startM.isPending} onClick={() => startM.mutate(true)} className="min-h-11 rounded-full border border-[var(--color-border)] px-4 text-sm text-[var(--color-text-secondary)] transition hover:border-[var(--color-brand)] disabled:opacity-50">{startM.isPending ? "…" : "New code"}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}
    </div>
  );
}

function CheckBadge() {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--color-brand)] text-[var(--color-on-brand)]">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

function AvatarPicker({ bearer, avatarUrl, onSaved }: { bearer: string; avatarUrl: string | null; onSaved: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async (file: File) => { const objectId = await uploadFile(bearer, file, "avatar"); return updateProfile(bearer, { avatar_object_id: objectId }); },
    onSuccess: onSaved, onError: () => setPreview(null),
  });
  const shown = preview ?? avatarUrl;
  return (
    <div className="flex items-center gap-4">
      <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text-muted)]">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Your avatar" className="h-full w-full object-cover" />
        ) : "No photo"}
        {m.isPending ? <span className="absolute inset-0 grid place-items-center bg-black/50"><span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /></span> : null}
      </div>
      <div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPreview(URL.createObjectURL(f)); m.mutate(f); } }} />
        <button onClick={() => inputRef.current?.click()} className="cursor-pointer rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] transition hover:border-[var(--color-brand)]">{shown ? "Replace photo" : "Upload photo"}</button>
      </div>
    </div>
  );
}

// A linked video's thumbnail. Shows the real scraped frame; if there's no
// thumbnail (or it fails to load — e.g. an expired IG CDN link), falls back to
// a clean "Watch on <platform>" card instead of a broken/black box.
function PortfolioStep({ bearer, portfolio, onChanged }: { bearer: string; portfolio: { id: string; video_url: string | null; thumbnail_url: string | null; is_upload: boolean; brand_name: string | null; platform?: Platform | null }[]; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState<{ url: string; platform?: string | null; thumbnail_url?: string | null; is_upload?: boolean } | null>(null);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState("");
  // Which of the two add methods is showing: upload a file, or paste a link.
  const [mode, setMode] = useState<"file" | "link">("file");
  const [linkUrl, setLinkUrl] = useState("");
  const upM = useMutation({
    mutationFn: (file: File) => uploadPortfolioVideo(bearer, file, {}, setPct),
    onSuccess: () => { setPct(0); if (fileRef.current) fileRef.current.value = ""; onChanged(); },
    onError: (e) => { setError((e as Error).message); setPct(0); },
  });
  const linkM = useMutation({
    mutationFn: (url: string) => addPortfolio(bearer, { video_url: url.trim(), platform: platformFromUrl(url) ?? undefined }),
    onSuccess: () => { setLinkUrl(""); onChanged(); },
    onError: (e) => setError((e as Error).message),
  });
  const delM = useMutation({ mutationFn: (id: string) => deletePortfolio(bearer, id), onSuccess: onChanged });

  const addLink = () => {
    setError("");
    if (!isValidVideoUrl(linkUrl)) { setError("Enter a valid video URL (starting with http)."); return; }
    linkM.mutate(linkUrl);
  };

  return (
    <div className="space-y-4">
      {portfolio.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {portfolio.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)]">
              <VideoThumb
                videoUrl={p.video_url}
                thumbnailUrl={p.thumbnail_url}
                platform={p.platform ?? null}
                isUpload={p.is_upload}
                label={p.brand_name ?? undefined}
                className="aspect-video w-full"
                onPlay={() => p.video_url && setPlaying({ url: p.video_url, platform: p.platform ?? null, thumbnail_url: p.thumbnail_url, is_upload: p.is_upload })}
              />
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 truncate text-xs text-[var(--color-text-secondary)]">{p.brand_name || (p.is_upload ? "Uploaded video" : "Linked video")}</span>
                <button className="shrink-0 cursor-pointer text-xs text-[var(--color-danger)]" onClick={() => delM.mutate(p.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-[var(--color-text-muted)]">No videos uploaded yet.</p>}

      {playing ? (
        <VideoModal
          url={playing.url}
          platform={playing.platform}
          thumbnailUrl={playing.thumbnail_url}
          isUpload={playing.is_upload}
          onClose={() => setPlaying(null)}
        />
      ) : null}

      {/* two add options: from computer, or a link to a video */}
      <div className="inline-flex rounded-full bg-[var(--color-surface)] p-1">
        {(["file", "link"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(""); }}
            className={`min-h-8 cursor-pointer rounded-full px-4 text-sm transition ${
              mode === m ? "bg-[var(--color-surface-2)] font-medium text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {m === "file" ? "From computer" : "Video link"}
          </button>
        ))}
      </div>

      <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setError(""); upM.mutate(f); } }} />

      {mode === "file" ? (
        upM.isPending ? (
          <div className="space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]"><div className="h-full rounded-full bg-[var(--color-brand)] transition-all" style={{ width: `${pct}%` }} /></div>
            <p className="text-xs text-[var(--color-text-secondary)]">Uploading… {pct}%</p>
          </div>
        ) : <div className="w-48"><Button type="button" onClick={() => fileRef.current?.click()}>Upload a video</Button></div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            inputMode="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
            placeholder="Paste a TikTok, YouTube, Instagram… link"
            className="min-h-11 flex-1 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus-visible:border-[var(--color-brand)]"
          />
          <div className="w-32"><Button type="button" loading={linkM.isPending} disabled={!linkUrl.trim()} onClick={addLink}>Add link</Button></div>
        </div>
      )}
      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}

function DoneStep({ name, hasType, socialCount, portfolioCount, hasPayout, campaignNext }: { name: string; hasType: boolean; socialCount: number; portfolioCount: number; hasPayout: boolean; campaignNext: string }) {
  const checks = [
    { ok: hasType, label: "Creator type" },
    { ok: socialCount > 0, label: `Social accounts (${socialCount})` },
    { ok: portfolioCount > 0, label: `Portfolio videos (${portfolioCount})` },
    { ok: hasPayout, label: "Payout method" },
  ];
  const done = checks.filter((c) => c.ok).length;
  const pct = Math.round((done / checks.length) * 100);
  return (
    <div className="text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--color-brand)]/15 text-3xl">🎉</div>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--color-text)]">You&apos;re all set, {name}!</h1>
      <p className="mt-2 text-[var(--color-text-secondary)]">Your profile is {pct}% complete. Browse campaigns now and get paid!</p>
      <div className="mx-auto mt-6 max-w-sm space-y-2 text-left">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-[var(--radius-btn)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm">
            <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${c.ok ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "border border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>{c.ok ? "✓" : ""}</span>
            <span className={c.ok ? "text-[var(--color-text)]" : "text-[var(--color-text-secondary)]"}>{c.label}</span>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-8 w-64">
        {/* Routes back to the exact campaign the creator started on (Bill's flow)
            when we came in via ?next=/campaigns/<slug>; otherwise Explore. */}
        <Link href={campaignNext} className="flex min-h-11 items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] shadow-[0_0_20px_-4px_rgba(34,197,94,0.7)] transition hover:bg-[var(--color-brand-hover)]">
          {campaignNext.startsWith("/campaigns/") ? "Go to your campaign →" : "Go to your dashboard →"}
        </Link>
      </div>
    </div>
  );
}
