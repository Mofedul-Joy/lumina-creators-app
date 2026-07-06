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
  CREATOR_TYPES, GENDERS, PAYOUT_METHODS, PLATFORMS,
  type CreatorType, type PayoutMethod, type Platform, type ProfileIn,
  addSocial, deletePortfolio, deleteSocial, getProfile, listPortfolio, listSocials,
  updateProfile, uploadFile, uploadPortfolioVideo,
} from "@/lib/api";

// Progressive, one-section-per-screen onboarding (SideShift-style flow, Lumina
// dark-green skin). Save-as-you-go: each Continue persists via the existing
// APIs; there is no server completion gate, so partial saves are safe. Every
// step pre-fills from the loaded profile, so this doubles as "edit profile".

const STEPS = [
  { key: "type", label: "You" },
  { key: "details", label: "Details" },
  { key: "socials", label: "Socials" },
  { key: "portfolio", label: "Videos" },
  { key: "audience", label: "Audience", optional: true },
  { key: "payment", label: "Payment" },
  { key: "done", label: "Done" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

const CREATOR_TYPE_COPY: Record<CreatorType, { title: string; blurb: string; icon: string }> = {
  ugc: { title: "UGC creator", blurb: "I make content for brands to use in their own ads.", icon: "🎬" },
  influencer: { title: "Influencer", blurb: "I post to my own audience and drive engagement.", icon: "📣" },
  both: { title: "Both", blurb: "I create UGC and post to my own following.", icon: "✨" },
};
const PAYOUT_LABEL: Record<PayoutMethod, string> = { paypal: "PayPal", solana: "Solana (wallet)", whop: "Whop" };
const PAYOUT_PLACEHOLDER: Record<PayoutMethod, string> = {
  paypal: "PayPal email", solana: "Solana wallet address", whop: "Whop username",
};

const control =
  "min-h-11 w-full rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-base text-[var(--color-text)] outline-none transition focus-visible:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]";
const labelCls = "block text-sm font-medium text-[var(--color-text)]";

// old ?tab= deep-links (from the dashboard cards / payout gate) → wizard steps
function resolveInitialStep(raw: string | null): number {
  if (!raw) return 0;
  const alias: Record<string, StepKey> = { personal: "details", social: "socials", portfolio: "portfolio", payment: "payment" };
  const key = (alias[raw] ?? raw) as StepKey;
  const i = STEPS.findIndex((s) => s.key === key);
  return i < 0 ? 0 : i;
}

export function OnboardingWizard() {
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();

  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    setToken(getAuthToken());
    setReady(true);
    setStep(resolveInitialStep(sp.get("step") ?? sp.get("tab")));
  }, [sp]);
  const bearer = token ?? "";
  const enabled = ready && !!token;

  const profileQ = useQuery({
    queryKey: ["profile"], queryFn: () => getProfile(bearer), enabled, retry: false,
    staleTime: Infinity, refetchOnWindowFocus: false, refetchOnMount: false,
  });
  const socialsQ = useQuery({ queryKey: ["socials"], queryFn: () => listSocials(bearer), enabled, retry: false });
  const portfolioQ = useQuery({ queryKey: ["portfolio"], queryFn: () => listPortfolio(bearer), enabled, retry: false });
  useEffect(() => { if (profileQ.isError) router.replace("/login"); }, [profileQ.isError, router]);

  // ---- editable local state, seeded once from the server ----
  const [creatorType, setCreatorType] = useState<CreatorType | "">("");
  const [details, setDetails] = useState({ display_name: "", bio: "" });
  const [audience, setAudience] = useState({ date_of_birth: "", gender: "", ethnicity: "", primary_language: "", country: "", city: "" });
  const [payout, setPayout] = useState({ method: "" as PayoutMethod | "", paypal: "", solana: "", whop: "" });
  const seeded = useRef(false);
  useEffect(() => {
    const d = profileQ.data;
    if (!d || seeded.current) return;
    seeded.current = true;
    setCreatorType((d.creator_type as CreatorType) ?? "");
    setDetails({ display_name: d.display_name ?? "", bio: d.bio ?? "" });
    setAudience({
      date_of_birth: d.date_of_birth ?? "", gender: d.gender ?? "", ethnicity: d.ethnicity ?? "",
      primary_language: d.primary_language ?? "", country: d.country ?? "", city: d.city ?? "",
    });
    setPayout({
      method: (d.payout_method as PayoutMethod) ?? "",
      paypal: d.payout_paypal ?? (d.payout_method === "paypal" ? d.payout_address ?? "" : ""),
      solana: d.payout_solana ?? (d.payout_method === "solana" ? d.payout_address ?? "" : ""),
      whop: d.payout_whop ?? (d.payout_method === "whop" ? d.payout_address ?? "" : ""),
    });
  }, [profileQ.data]);

  const saveM = useMutation({
    mutationFn: (patch: ProfileIn) => updateProfile(bearer, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
  const goTo = (i: number) => { saveM.reset(); setStep(Math.max(0, Math.min(STEPS.length - 1, i))); };
  const next = () => goTo(step + 1);
  const back = () => goTo(step - 1);
  async function commit(patch: ProfileIn) {
    try { await saveM.mutateAsync(patch); next(); } catch { /* error surfaced below */ }
  }

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
        <Skeleton className="h-2 w-full" />
        <Skeleton className="mt-8 h-9 w-72" />
        <Skeleton className="h-64 w-full" />
      </main>
    );

  const socials = socialsQ.data ?? [];
  const portfolio = portfolioQ.data ?? [];
  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const err = saveM.isError ? (saveM.error as Error).message : "";

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      {/* progress: thin bar + clickable step pills */}
      <div className="mb-8">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
          <div className="h-full rounded-full bg-[var(--color-brand)] transition-all duration-300" style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => goTo(i)}
              className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] transition ${
                i === step
                  ? "bg-[var(--color-brand)]/15 font-medium text-[var(--color-brand-soft)]"
                  : i < step
                    ? "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {i < step ? "✓ " : ""}{s.label}
            </button>
          ))}
        </div>
      </div>

      {/* step body */}
      <div className="min-h-[320px]">
        {cur.key === "type" ? (
          <StepShell eyebrow="Welcome to Lumina" title="What kind of creator are you?" sub="This helps us match you to the right campaigns. You can change it anytime.">
            <div className="grid gap-3">
              {CREATOR_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setCreatorType(t)}
                  className={`card-grad flex items-center gap-4 rounded-[var(--radius-card)] p-4 text-left transition ${
                    creatorType === t ? "ring-2 ring-[var(--color-brand)]" : "hover:ring-1 hover:ring-[var(--color-border)]"
                  }`}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-2)] text-xl">{CREATOR_TYPE_COPY[t].icon}</span>
                  <span>
                    <span className="block font-semibold text-[var(--color-text)]">{CREATOR_TYPE_COPY[t].title}</span>
                    <span className="block text-sm text-[var(--color-text-secondary)]">{CREATOR_TYPE_COPY[t].blurb}</span>
                  </span>
                </button>
              ))}
            </div>
          </StepShell>
        ) : null}

        {cur.key === "details" ? (
          <StepShell eyebrow="About you" title="Add your name and photo" sub="This is what brands see first.">
            <AvatarPicker bearer={bearer} avatarUrl={profileQ.data?.avatar_url ?? null} onSaved={() => qc.invalidateQueries({ queryKey: ["profile"] })} />
            <div className="mt-5 space-y-4">
              <Field label="Display name" placeholder="Your name or handle" value={details.display_name} onChange={(e) => setDetails({ ...details, display_name: e.target.value })} />
              <div className="space-y-2">
                <label className={labelCls}>Bio</label>
                <textarea rows={3} className={control + " py-2"} placeholder="A sentence about the content you make…" value={details.bio} onChange={(e) => setDetails({ ...details, bio: e.target.value })} />
              </div>
            </div>
          </StepShell>
        ) : null}

        {cur.key === "socials" ? (
          <StepShell eyebrow="Your reach" title="Add your social accounts" sub="Creators with 3+ platforms get matched to more campaigns.">
            <SocialsStep bearer={bearer} socials={socials} onChanged={() => qc.invalidateQueries({ queryKey: ["socials"] })} />
          </StepShell>
        ) : null}

        {cur.key === "portfolio" ? (
          <StepShell eyebrow="Show your work" title="Upload your best videos" sub="Brands watch these when matching campaigns to you. These are showcase clips, separate from campaign submissions.">
            <PortfolioStep bearer={bearer} portfolio={portfolio} onChanged={() => qc.invalidateQueries({ queryKey: ["portfolio"] })} />
          </StepShell>
        ) : null}

        {cur.key === "audience" ? (
          <StepShell eyebrow="Optional" title="Tell brands about your audience" sub="All optional — the more you share, the better we can match you. Skip anytime.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Date of birth" type="date" value={audience.date_of_birth} onChange={(e) => setAudience({ ...audience, date_of_birth: e.target.value })} />
              <div className="space-y-2">
                <label className={labelCls}>Gender</label>
                <select className={control} value={audience.gender} onChange={(e) => setAudience({ ...audience, gender: e.target.value })}>
                  <option value="">Select…</option>
                  {GENDERS.map((g) => <option key={g} value={g}>{g.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <Field label="Primary language" value={audience.primary_language} onChange={(e) => setAudience({ ...audience, primary_language: e.target.value })} />
              <Field label="Country" value={audience.country} onChange={(e) => setAudience({ ...audience, country: e.target.value })} />
              <Field label="City" value={audience.city} onChange={(e) => setAudience({ ...audience, city: e.target.value })} />
              <Field label="Ethnicity" value={audience.ethnicity} onChange={(e) => setAudience({ ...audience, ethnicity: e.target.value })} />
            </div>
          </StepShell>
        ) : null}

        {cur.key === "payment" ? (
          <StepShell eyebrow="Getting paid" title="Where should we send your earnings?" sub="Set this before you request a payout. Each method keeps its own details.">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {PAYOUT_METHODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setPayout({ ...payout, method: payout.method === m ? "" : m })}
                    className={`cursor-pointer rounded-full px-4 py-2 text-sm transition ${
                      payout.method === m ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {PAYOUT_LABEL[m]}
                  </button>
                ))}
              </div>
              {payout.method ? (
                <div className="space-y-2">
                  <label className={labelCls}>{PAYOUT_LABEL[payout.method]} details</label>
                  <input
                    className={control}
                    placeholder={PAYOUT_PLACEHOLDER[payout.method]}
                    value={payout[payout.method]}
                    onChange={(e) => setPayout({ ...payout, [payout.method as PayoutMethod]: e.target.value } as typeof payout)}
                  />
                </div>
              ) : null}
            </div>
          </StepShell>
        ) : null}

        {cur.key === "done" ? (
          <DoneStep
            name={(profileQ.data?.display_name ?? "").trim().split(" ")[0] || "creator"}
            missing={profileQ.data?.missing ?? []}
            hasType={!!creatorType}
            socialCount={socials.length}
            portfolioCount={portfolio.length}
            hasPayout={!!payout.method}
          />
        ) : null}
      </div>

      {err ? <p className="mt-4 text-sm text-[var(--color-danger)]">{err}</p> : null}

      {/* footer nav */}
      {!isLast ? (
        <div className="mt-8 flex items-center justify-between gap-3">
          <button onClick={back} disabled={step === 0}
            className="cursor-pointer rounded-full px-4 py-2 text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)] disabled:invisible">
            ← Back
          </button>
          <div className="flex items-center gap-3">
            {cur.optional ? (
              <button onClick={next} className="cursor-pointer text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]">Skip for now</button>
            ) : null}
            <div className="w-40">
              <Button
                loading={saveM.isPending}
                disabled={cur.key === "type" && !creatorType}
                onClick={() => {
                  if (cur.key === "type") return void commit({ creator_type: creatorType || undefined });
                  if (cur.key === "details") return void commit({ display_name: details.display_name || undefined, bio: details.bio || undefined });
                  if (cur.key === "audience") return void commit({
                    date_of_birth: audience.date_of_birth || undefined, gender: (audience.gender || undefined) as ProfileIn["gender"],
                    ethnicity: audience.ethnicity || undefined, primary_language: audience.primary_language || undefined,
                    country: audience.country || undefined, city: audience.city || undefined,
                  });
                  if (cur.key === "payment") return void commit({
                    payout_method: (payout.method || undefined) as PayoutMethod | undefined,
                    payout_paypal: payout.paypal || undefined, payout_solana: payout.solana || undefined, payout_whop: payout.whop || undefined,
                  });
                  next(); // socials / portfolio save inline on add
                }}
              >
                Continue
              </Button>
            </div>
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

function AvatarPicker({ bearer, avatarUrl, onSaved }: { bearer: string; avatarUrl: string | null; onSaved: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: async (file: File) => {
      const objectId = await uploadFile(bearer, file, "avatar");
      return updateProfile(bearer, { avatar_object_id: objectId });
    },
    onSuccess: onSaved,
    onError: () => setPreview(null),
  });
  const shown = preview ?? avatarUrl;
  return (
    <div className="flex items-center gap-4">
      <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text-muted)]">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Your avatar" className="h-full w-full object-cover" />
        ) : "No photo"}
        {m.isPending ? (
          <span className="absolute inset-0 grid place-items-center bg-black/50">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </span>
        ) : null}
      </div>
      <div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPreview(URL.createObjectURL(f)); m.mutate(f); } }} />
        <button onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] transition hover:border-[var(--color-brand)]">
          {shown ? "Replace photo" : "Upload photo"}
        </button>
      </div>
    </div>
  );
}

function SocialsStep({ bearer, socials, onChanged }: { bearer: string; socials: { id: string; platform: string; handle: string; follower_count: number }[]; onChanged: () => void }) {
  const [open, setOpen] = useState<Platform | null>(null);
  const [form, setForm] = useState({ handle: "", follower_count: "" });
  const addM = useMutation({
    mutationFn: () => addSocial(bearer, { platform: open!, handle: form.handle.trim(), follower_count: Number(form.follower_count) || 0 }),
    onSuccess: () => { setOpen(null); setForm({ handle: "", follower_count: "" }); onChanged(); },
  });
  const delM = useMutation({ mutationFn: (id: string) => deleteSocial(bearer, id), onSuccess: onChanged });
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {PLATFORMS.map((p) => {
        const existing = socials.find((s) => s.platform === p);
        const isOpen = open === p;
        return (
          <div key={p} className={`rounded-[var(--radius-btn)] border p-3 transition ${existing ? "border-[var(--color-brand)]/40 bg-[var(--color-brand)]/5" : "border-[var(--color-border)]"}`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium text-[var(--color-text)]"><PlatformIcon name={p} className="h-4 w-4" /> {platformLabel(p)}</span>
              {existing ? (
                <button className="cursor-pointer text-xs text-[var(--color-danger)]" onClick={() => delM.mutate(existing.id)}>Remove</button>
              ) : (
                <button className="cursor-pointer text-xs font-medium text-[var(--color-brand)]" onClick={() => { setOpen(isOpen ? null : p); setForm({ handle: "", follower_count: "" }); }}>
                  {isOpen ? "Cancel" : "+ Add"}
                </button>
              )}
            </div>
            {existing ? (
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">@{existing.handle} · <span className="tabular">{existing.follower_count.toLocaleString()}</span> followers</p>
            ) : isOpen ? (
              <div className="mt-3 space-y-2">
                <input className={control + " text-sm"} placeholder="handle (without @)" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} />
                <input className={control + " text-sm"} type="number" placeholder="follower count" value={form.follower_count} onChange={(e) => setForm({ ...form, follower_count: e.target.value })} />
                {addM.isError ? <p className="text-xs text-[var(--color-danger)]">{(addM.error as Error).message}</p> : null}
                <Button type="button" loading={addM.isPending} disabled={!form.handle.trim()} onClick={() => addM.mutate()}>Add {platformLabel(p)}</Button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PortfolioStep({ bearer, portfolio, onChanged }: { bearer: string; portfolio: { id: string; video_url: string | null; thumbnail_url: string | null; is_upload: boolean; brand_name: string | null }[]; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState("");
  const upM = useMutation({
    mutationFn: (file: File) => uploadPortfolioVideo(bearer, file, {}, setPct),
    onSuccess: () => { setPct(0); if (fileRef.current) fileRef.current.value = ""; onChanged(); },
    onError: (e) => { setError((e as Error).message); setPct(0); },
  });
  const delM = useMutation({ mutationFn: (id: string) => deletePortfolio(bearer, id), onSuccess: onChanged });
  return (
    <div className="space-y-4">
      {portfolio.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {portfolio.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)]">
              {p.is_upload && p.video_url ? (
                <video src={p.video_url} controls playsInline preload="metadata" poster={p.thumbnail_url ?? undefined} className="aspect-video w-full bg-black object-contain" />
              ) : (
                <a href={p.video_url ?? "#"} target="_blank" rel="noreferrer" className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-[var(--color-brand)]/20 to-[var(--color-bg-deep)] text-sm font-medium text-[var(--color-brand)]">Open video link ↗</a>
              )}
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 truncate text-xs text-[var(--color-text-secondary)]">{p.brand_name || "Portfolio video"}</span>
                <button className="shrink-0 cursor-pointer text-xs text-[var(--color-danger)]" onClick={() => delM.mutate(p.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">No videos uploaded yet.</p>
      )}
      <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setError(""); upM.mutate(f); } }} />
      {upM.isPending ? (
        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]"><div className="h-full rounded-full bg-[var(--color-brand)] transition-all" style={{ width: `${pct}%` }} /></div>
          <p className="text-xs text-[var(--color-text-secondary)]">Uploading… {pct}%</p>
        </div>
      ) : (
        <div className="w-48"><Button type="button" onClick={() => fileRef.current?.click()}>Upload a video</Button></div>
      )}
      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}

function DoneStep({ name, hasType, socialCount, portfolioCount, hasPayout }: {
  name: string; missing: string[]; hasType: boolean; socialCount: number; portfolioCount: number; hasPayout: boolean;
}) {
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
      <p className="mt-2 text-[var(--color-text-secondary)]">Your profile is {pct}% complete. You can browse campaigns now — a fuller profile gets matched to more.</p>

      <div className="mx-auto mt-6 max-w-sm space-y-2 text-left">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-3 rounded-[var(--radius-btn)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm">
            <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${c.ok ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "border border-[var(--color-border)] text-[var(--color-text-muted)]"}`}>{c.ok ? "✓" : ""}</span>
            <span className={c.ok ? "text-[var(--color-text)]" : "text-[var(--color-text-secondary)]"}>{c.label}</span>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-8 w-56">
        <Link href="/campaigns" className="flex min-h-11 items-center justify-center rounded-full bg-[var(--color-brand)] px-5 text-sm font-semibold text-[var(--color-on-brand)] shadow-[0_0_20px_-4px_rgba(34,197,94,0.7)] transition hover:bg-[var(--color-brand-hover)]">
          Browse campaigns →
        </Link>
      </div>
    </div>
  );
}
