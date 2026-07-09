"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { getAuthToken } from "@/lib/auth";
import {
  CREATOR_TYPES, EDUCATION_LEVELS, GENDERS, PAYOUT_METHODS,
  type CreatorType, type EducationLevel, type Gender, type PayoutMethod, type Platform, type ProfileIn,
  addPortfolio, addSocial, confirmSocialVerify, deletePortfolio, deleteSocial, getProfile, listPortfolio, listSocials,
  startSocialVerify, updateProfile, uploadFile, uploadPortfolioVideo,
} from "@/lib/api";
import { isValidVideoUrl, platformFromUrl } from "@/lib/videoLink";
import { COUNTRIES } from "@/lib/countries";

// Progressive, one-question-per-screen onboarding — the granular SideShift-style
// flow in the Lumina dark-green skin. Save-as-you-go (no server completion gate);
// every step pre-fills from the profile so this doubles as "edit profile".

type StepKey =
  | "type" | "name" | "photo" | "bio"
  | "soc_instagram" | "soc_tiktok" | "soc_youtube" | "soc_twitter" | "soc_facebook"
  | "portfolio" | "birthday" | "gender" | "education" | "ethnicity" | "language" | "location"
  | "payment" | "done";

const STEPS: { key: StepKey; optional?: boolean }[] = [
  { key: "type" },
  { key: "name", optional: true },
  { key: "photo", optional: true },
  { key: "bio", optional: true },
  { key: "soc_instagram", optional: true },
  { key: "soc_tiktok", optional: true },
  { key: "soc_youtube", optional: true },
  { key: "soc_twitter", optional: true },
  { key: "soc_facebook", optional: true },
  { key: "portfolio", optional: true },
  { key: "birthday", optional: true },
  { key: "gender", optional: true },
  { key: "education", optional: true },
  { key: "ethnicity", optional: true },
  { key: "language", optional: true },
  { key: "location", optional: true },
  { key: "payment", optional: true },
  { key: "done" },
];

// coarse sections for the clickable progress header (18 pills would be unusable)
const SECTIONS: { label: string; first: StepKey }[] = [
  { label: "About", first: "type" },
  { label: "Socials", first: "soc_instagram" },
  { label: "Videos", first: "portfolio" },
  { label: "Details", first: "birthday" },
  { label: "Payment", first: "payment" },
];
const SECTION_STARTS = SECTIONS.map((s) => STEPS.findIndex((x) => x.key === s.first));

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
  const alias: Record<string, StepKey> = { personal: "name", social: "soc_instagram", socials: "soc_instagram", portfolio: "portfolio", payment: "payment", details: "birthday" };
  const key = (alias[raw] ?? raw) as StepKey;
  const i = STEPS.findIndex((s) => s.key === key);
  return i < 0 ? 0 : i;
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

  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => getProfile(bearer), enabled, retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnMount: false });
  const socialsQ = useQuery({ queryKey: ["socials"], queryFn: () => listSocials(bearer), enabled, retry: false });
  const portfolioQ = useQuery({ queryKey: ["portfolio"], queryFn: () => listPortfolio(bearer), enabled, retry: false });
  useEffect(() => { if (profileQ.isError) router.replace("/login"); }, [profileQ.isError, router]);

  const [creatorType, setCreatorType] = useState<CreatorType | "">("");
  const [details, setDetails] = useState({ display_name: "", bio: "" });
  const [audience, setAudience] = useState({ date_of_birth: "", gender: "", education: "", ethnicity: "", primary_language: "", country: "", city: "" });
  const [payout, setPayout] = useState({ method: "" as PayoutMethod | "", paypal: "", solana: "", whop: "" });
  const [socialForms, setSocialForms] = useState<Record<string, { handle: string; followers: string }>>({});
  const seeded = useRef(false);
  useEffect(() => {
    const d = profileQ.data;
    if (!d || seeded.current) return;
    seeded.current = true;
    setCreatorType((d.creator_type as CreatorType) ?? "");
    setDetails({ display_name: d.display_name ?? "", bio: d.bio ?? "" });
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
  if (!ready || profileQ.isLoading || !seeded.current)
    return (
      <main className="mx-auto max-w-xl px-6 py-12 space-y-4">
        <Skeleton className="h-2 w-full" /><Skeleton className="mt-8 h-9 w-72" /><Skeleton className="h-64 w-full" />
      </main>
    );

  const socials = socialsQ.data ?? [];
  const portfolio = portfolioQ.data ?? [];
  const cur = STEPS[step];

  // Required steps can't be skipped and gate the Continue button until valid.
  // Instagram + TikTok must be VERIFIED; YouTube/X/Facebook stay optional.
  const isVerifiedSocial = (p: Platform) => socials.some((s) => s.platform === p && s.is_verified);
  // Required to move forward (no skip). Payment + gender are NOT required —
  // creators can set payment up later, and IG/TikTok are the required socials.
  const REQUIRED: Partial<Record<StepKey, boolean>> = {
    type: !!creatorType,
    name: !!details.display_name.trim(),
    soc_instagram: isVerifiedSocial("instagram"),
    soc_tiktok: isVerifiedSocial("tiktok"),
    portfolio: portfolio.length > 0,
    birthday: !!audience.date_of_birth,
    location: !!(audience.country.trim() && audience.city.trim()),
  };
  const stepRequired = cur.key in REQUIRED;
  const canContinue = !stepRequired || !!REQUIRED[cur.key];
  const isLast = step === STEPS.length - 1;
  const curSection = SECTION_STARTS.reduce((acc, start, i) => (step >= start ? i : acc), 0);
  const err = saveM.isError ? (saveM.error as Error).message : addSocialM.isError ? (addSocialM.error as Error).message : "";
  const committing = saveM.isPending || addSocialM.isPending;

  async function onContinue() {
    try {
      const k = cur.key;
      if (k === "type") await saveM.mutateAsync({ creator_type: creatorType || undefined });
      else if (k === "name") await saveM.mutateAsync({ display_name: details.display_name || undefined });
      else if (k === "bio") await saveM.mutateAsync({ bio: details.bio || undefined });
      else if (k === "birthday") await saveM.mutateAsync({ date_of_birth: audience.date_of_birth || undefined });
      else if (k === "gender") await saveM.mutateAsync({ gender: (audience.gender || undefined) as Gender | undefined });
      else if (k === "education") await saveM.mutateAsync({ education: (audience.education || undefined) as EducationLevel | undefined });
      else if (k === "ethnicity") await saveM.mutateAsync({ ethnicity: audience.ethnicity || undefined });
      else if (k === "language") await saveM.mutateAsync({ primary_language: audience.primary_language || undefined });
      else if (k === "location") await saveM.mutateAsync({ country: audience.country || undefined, city: audience.city || undefined });
      else if (k === "payment") await saveM.mutateAsync({ payout_method: (payout.method || undefined) as PayoutMethod | undefined, payout_paypal: payout.paypal || undefined, payout_solana: payout.solana || undefined, payout_whop: payout.whop || undefined });
      else if (k.startsWith("soc_")) {
        const p = k.slice(4) as Platform;
        const f = socialForms[p];
        const existing = socials.find((s) => s.platform === p);
        // Instagram/TikTok are added ONLY through the Verify flow (which creates
        // the account) — never auto-add an unverified row here, or it would
        // create a duplicate that bypasses verification.
        const verifiable = p === "instagram" || p === "tiktok";
        if (!verifiable && f?.handle?.trim() && !existing) {
          await addSocialM.mutateAsync({ platform: p, handle: f.handle.trim(), follower_count: Number(f.followers) || 0 });
        }
      }
      next();
    } catch { /* err surfaced below */ }
  }

  const socialPlatform = cur.key.startsWith("soc_") ? (cur.key.slice(4) as Platform) : null;

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      {/* progress: thin bar + section pills + step counter */}
      <div className="mb-8">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
          <div className="h-full rounded-full bg-[var(--color-brand)] transition-all duration-300" style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {SECTIONS.map((s, i) => (
              <button key={s.label} onClick={() => goTo(SECTION_STARTS[i])}
                className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] transition ${i === curSection ? "bg-[var(--color-brand)]/15 font-medium text-[var(--color-brand-soft)]" : i < curSection ? "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}>
                {i < curSection ? "✓ " : ""}{s.label}
              </button>
            ))}
          </div>
          {!isLast ? <span className="text-[11px] text-[var(--color-text-muted)]">Step {step + 1} of {STEPS.length - 1}</span> : null}
        </div>
      </div>

      <div className="min-h-[340px]">
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

        {socialPlatform ? (
          <StepShell eyebrow="Your reach" title={`Are you on ${platformLabel(socialPlatform)}?`} sub={stepRequired ? "Verify your handle to continue — this one's required." : "Add your handle so brands can see your reach. Skip if you're not on it."}>
            <SocialStep
              platform={socialPlatform}
              bearer={bearer}
              existing={socials.find((s) => s.platform === socialPlatform)}
              form={socialForms[socialPlatform] ?? { handle: "", followers: "" }}
              onForm={(f) => setSocialForms({ ...socialForms, [socialPlatform]: f })}
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
          <StepShell eyebrow="A few details" title="When's your birthday?" sub="Brands use this to check you're old enough to work with them. Kept private.">
            <div className="max-w-xs">
              <Field label="Date of birth" type="date" value={audience.date_of_birth} onChange={(e) => setAudience({ ...audience, date_of_birth: e.target.value })} />
              {ageFrom(audience.date_of_birth) !== null ? (
                <p className="mt-2 text-sm text-[var(--color-brand-soft)]">{ageFrom(audience.date_of_birth)} years old</p>
              ) : null}
            </div>
          </StepShell>
        ) : null}

        {cur.key === "gender" ? (
          <StepShell eyebrow="A few details" title="What's your gender?" sub="Helps brands match campaigns. Optional.">
            <div className="grid gap-2">
              {GENDERS.map((g) => (
                <OptionCard key={g} compact selected={audience.gender === g} onClick={() => setAudience({ ...audience, gender: g })} title={GENDER_LABEL[g]} />
              ))}
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
          <StepShell eyebrow="A few details" title="Where are you based?" sub="Required — pick your real country and enter your real city (we verify it).">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className={labelCls}>Country</label>
                <select className={control} value={audience.country} onChange={(e) => setAudience({ ...audience, country: e.target.value })}>
                  <option value="">Select your country</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <Field label="City" placeholder="e.g. Nairobi" value={audience.city} onChange={(e) => setAudience({ ...audience, city: e.target.value })} />
            </div>
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
          <DoneStep name={(profileQ.data?.display_name ?? "").trim().split(" ")[0] || "creator"} hasType={!!creatorType} socialCount={socials.length} portfolioCount={portfolio.length} hasPayout={!!payout.method} />
        ) : null}
      </div>

      {err ? <p className="mt-4 text-sm text-[var(--color-danger)]">{err}</p> : null}

      {!isLast ? (
        <div className="mt-8 flex items-center justify-between gap-3">
          <button onClick={back} disabled={step === 0} className="cursor-pointer rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)] disabled:invisible">← Back</button>
          <div className="flex items-center gap-3">
            {cur.optional && !stepRequired ? <button onClick={next} className="cursor-pointer text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]">Skip for now</button> : null}
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
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-text)]">{title}</h1>
      {sub ? <p className="mt-2 text-[var(--color-text-secondary)]">{sub}</p> : null}
      <div className="mt-6">{children}</div>
    </div>
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

function SocialStep({ platform, bearer, existing, form, onForm, onRemove, onChanged }: {
  platform: Platform;
  bearer: string;
  existing?: { id: string; handle: string; follower_count: number; is_verified: boolean };
  form: { handle: string; followers: string };
  onForm: (f: { handle: string; followers: string }) => void;
  onRemove: (id: string) => void;
  onChanged: () => void;
}) {
  const verifiable = VERIFIABLE_PLATFORMS.includes(platform);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const startM = useMutation({
    mutationFn: () => startSocialVerify(bearer, platform, form.handle.trim()),
    onSuccess: (r) => { setCode(r.code); onChanged(); },
  });
  const confirmM = useMutation({
    mutationFn: () => confirmSocialVerify(bearer, platform, form.handle.trim()),
    onSuccess: () => { setCode(null); onChanged(); },
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
            @{existing.handle} · <span className="tabular text-[var(--color-text-secondary)]">{existing.follower_count.toLocaleString()}</span> followers
            <span className="rounded-full bg-[var(--color-brand)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--color-brand)]">Verified</span>
          </span>
          <button className="cursor-pointer text-xs text-[var(--color-danger)]" onClick={() => onRemove(existing.id)}>Remove</button>
        </div>
      ) : !verifiable ? (
        // youtube / x / facebook: self-reported handle + followers (no bio verify)
        existing ? (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
            <span className="text-sm text-[var(--color-text)]">@{existing.handle} · <span className="tabular text-[var(--color-text-secondary)]">{existing.follower_count.toLocaleString()}</span> followers</span>
            <button className="cursor-pointer text-xs text-[var(--color-danger)]" onClick={() => onRemove(existing.id)}>Remove</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input className={control} placeholder="handle (without @)" value={form.handle} onChange={(e) => onForm({ ...form, handle: e.target.value })} />
            <input className={control} type="number" placeholder="follower count" value={form.followers} onChange={(e) => onForm({ ...form, followers: e.target.value })} />
          </div>
        )
      ) : (
        // instagram / tiktok: bio-code verification
        <div className="space-y-3">
          <div className="flex items-center overflow-hidden rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)]">
            <span className="pl-3 pr-1 text-[var(--color-text-muted)]">@</span>
            <input
              className="min-h-11 flex-1 bg-transparent px-1 text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
              placeholder="your handle"
              value={form.handle}
              onChange={(e) => { onForm({ ...form, handle: e.target.value }); if (code) setCode(null); }}
            />
          </div>

          {!code ? (
            <button
              disabled={!form.handle.trim() || startM.isPending}
              onClick={() => startM.mutate()}
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
                <button onClick={() => startM.mutate()} className="min-h-11 rounded-full border border-[var(--color-border)] px-4 text-sm text-[var(--color-text-secondary)] transition hover:border-[var(--color-brand)]">New code</button>
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

function PortfolioStep({ bearer, portfolio, onChanged }: { bearer: string; portfolio: { id: string; video_url: string | null; thumbnail_url: string | null; is_upload: boolean; brand_name: string | null; platform?: Platform | null }[]; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
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
              {p.is_upload && p.video_url ? (
                <video src={p.video_url} controls playsInline preload="metadata" poster={p.thumbnail_url ?? undefined} className="aspect-video w-full bg-black object-contain" />
              ) : (
                // link video — real thumbnail if we scraped one, else a fallback card
                <a href={p.video_url ?? "#"} target="_blank" rel="noreferrer" className="group relative block aspect-video w-full overflow-hidden">
                  {p.thumbnail_url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.thumbnail_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                      <span className="pointer-events-none absolute inset-0 bg-black/25 transition group-hover:bg-black/10" />
                      <span className="absolute inset-0 grid place-items-center">
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5v14l11-7L8 5Z" /></svg>
                        </span>
                      </span>
                      {p.platform ? (
                        <span className="absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
                          <PlatformIcon name={p.platform} className="h-4 w-4" />
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[var(--color-brand)]/20 to-[var(--color-bg-deep)] text-sm font-medium text-[var(--color-brand)]">
                      {p.platform ? <PlatformIcon name={p.platform} className="h-7 w-7" /> : null}
                      <span className="flex items-center gap-1">Watch on {p.platform ? platformLabel(p.platform) : "source"} <span className="transition group-hover:translate-x-0.5">↗</span></span>
                    </span>
                  )}
                </a>
              )}
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 truncate text-xs text-[var(--color-text-secondary)]">{p.brand_name || (p.is_upload ? "Uploaded video" : "Linked video")}</span>
                <button className="shrink-0 cursor-pointer text-xs text-[var(--color-danger)]" onClick={() => delM.mutate(p.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-[var(--color-text-muted)]">No videos uploaded yet.</p>}

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

function DoneStep({ name, hasType, socialCount, portfolioCount, hasPayout }: { name: string; hasType: boolean; socialCount: number; portfolioCount: number; hasPayout: boolean }) {
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
      <p className="mt-2 text-[var(--color-text-secondary)]">Your profile is {pct}% complete. Browse campaigns now — a fuller profile gets matched to more.</p>
      <div className="mx-auto mt-6 max-w-sm space-y-2 text-left">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-[var(--radius-btn)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm">
            <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${c.ok ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "border border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>{c.ok ? "✓" : ""}</span>
            <span className={c.ok ? "text-[var(--color-text)]" : "text-[var(--color-text-secondary)]"}>{c.label}</span>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-8 w-56">
        <Link href="/campaigns" className="flex min-h-11 items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] shadow-[0_0_20px_-4px_rgba(34,197,94,0.7)] transition hover:bg-[var(--color-brand-hover)]">Browse campaigns →</Link>
      </div>
    </div>
  );
}
