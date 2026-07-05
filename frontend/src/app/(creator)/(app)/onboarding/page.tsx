"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
// note: form is seeded from the server ONCE, later refetches (from adding a
// social/portfolio) must not clobber the basics the user is typing.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PlatformIcon, platformLabel } from "@/components/ui/PlatformIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { getAuthToken } from "@/lib/auth";
import {
  GENDERS,
  PAYOUT_METHODS,
  PLATFORMS,
  type PayoutMethod,
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

const PAYOUT_LABEL: Record<PayoutMethod, string> = { paypal: "PayPal", solana: "Solana (wallet)", whop: "Whop" };
const PAYOUT_PLACEHOLDER: Record<PayoutMethod, string> = {
  paypal: "PayPal email", solana: "Solana wallet address", whop: "Whop username",
};

const TABS = [
  { key: "personal", label: "Personal info" },
  { key: "social", label: "Social accounts" },
  { key: "portfolio", label: "Portfolio" },
  { key: "payment", label: "Payment info" },
] as const;
type Tab = (typeof TABS)[number]["key"];

type ProfileForm = {
  display_name: string; bio: string; date_of_birth: string; gender: string;
  ethnicity: string; primary_language: string; country: string; city: string;
};
const EMPTY: ProfileForm = {
  display_name: "", bio: "", date_of_birth: "", gender: "",
  ethnicity: "", primary_language: "", country: "", city: "",
};

export default function ProfilePage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("personal");
  useEffect(() => {
    setToken(getAuthToken());
    setReady(true);
    // deep-link: /onboarding?tab=payment (from the payout gate) or ?tab=portfolio
    // (from the dashboard card) opens straight to that tab.
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted && TABS.some((t) => t.key === wanted)) setTab(wanted as Tab);
  }, []);
  const enabled = ready && !!token;
  const bearer = token ?? "";

  const profileQ = useQuery({
    queryKey: ["profile"], queryFn: () => getProfile(bearer), enabled, retry: false,
    staleTime: Infinity, refetchOnWindowFocus: false, refetchOnMount: false,
  });
  const socialsQ = useQuery({ queryKey: ["socials"], queryFn: () => listSocials(bearer), enabled, retry: false });
  const portfolioQ = useQuery({ queryKey: ["portfolio"], queryFn: () => listPortfolio(bearer), enabled, retry: false });

  const [form, setForm] = useState<ProfileForm>(EMPTY);
  // Each method keeps its own address so switching method never reuses another
  // method's value.
  const [payout, setPayout] = useState<{ method: string; paypal: string; solana: string; whop: string }>({
    method: "", paypal: "", solana: "", whop: "",
  });
  const [banner, setBanner] = useState("");
  const [saved, setSaved] = useState(false);
  const seeded = useRef(false);
  useEffect(() => { if (profileQ.isError) router.replace("/login"); }, [profileQ.isError, router]);
  useEffect(() => {
    const d = profileQ.data;
    if (d && !seeded.current) {
      seeded.current = true;
      setForm({
        display_name: d.display_name ?? "", bio: d.bio ?? "", date_of_birth: d.date_of_birth ?? "",
        gender: d.gender ?? "", ethnicity: d.ethnicity ?? "", primary_language: d.primary_language ?? "",
        country: d.country ?? "", city: d.city ?? "",
      });
      // fall back to the legacy single address for whichever method it belonged to
      setPayout({
        method: d.payout_method ?? "",
        paypal: d.payout_paypal ?? (d.payout_method === "paypal" ? d.payout_address ?? "" : ""),
        solana: d.payout_solana ?? (d.payout_method === "solana" ? d.payout_address ?? "" : ""),
        whop: d.payout_whop ?? (d.payout_method === "whop" ? d.payout_address ?? "" : ""),
      });
    }
  }, [profileQ.data]);

  // avatar
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const avatarM = useMutation({
    mutationFn: async (file: File) => {
      const objectId = await uploadFile(bearer, file, "avatar");
      return updateProfile(bearer, { avatar_object_id: objectId });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
    onError: () => setLocalPreview(null),
  });
  function pickAvatar(file: File) {
    setLocalPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
    avatarM.mutate(file);
  }

  // socials
  const [openPlatform, setOpenPlatform] = useState<Platform | null>(null);
  const [socialForm, setSocialForm] = useState({ handle: "", profile_url: "", follower_count: "" });
  const addSocialM = useMutation({
    mutationFn: () => addSocial(bearer, {
      platform: openPlatform!, handle: socialForm.handle.trim(),
      profile_url: socialForm.profile_url.trim() || undefined,
      follower_count: Number(socialForm.follower_count) || 0,
    }),
    onSuccess: () => { setOpenPlatform(null); setSocialForm({ handle: "", profile_url: "", follower_count: "" }); qc.invalidateQueries({ queryKey: ["socials"] }); },
  });
  const removeSocialM = useMutation({ mutationFn: (id: string) => deleteSocial(bearer, id), onSuccess: () => qc.invalidateQueries({ queryKey: ["socials"] }) });

  // portfolio
  const [portfolioForm, setPortfolioForm] = useState({ video_url: "", brand_name: "", caption: "" });
  const addPortfolioM = useMutation({
    mutationFn: () => addPortfolio(bearer, {
      video_url: portfolioForm.video_url.trim(),
      brand_name: portfolioForm.brand_name.trim() || undefined,
      caption: portfolioForm.caption.trim() || undefined,
    }),
    onSuccess: () => { setPortfolioForm({ video_url: "", brand_name: "", caption: "" }); qc.invalidateQueries({ queryKey: ["portfolio"] }); },
  });
  const removePortfolioM = useMutation({ mutationFn: (id: string) => deletePortfolio(bearer, id), onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }) });

  const socials = socialsQ.data ?? [];
  const portfolio = portfolioQ.data ?? [];
  const avatarUrl = profileQ.data?.avatar_url ?? null;

  const saveM = useMutation({
    mutationFn: (patch: ProfileIn) => updateProfile(bearer, patch),
    onSuccess: () => { setBanner(""); setSaved(true); setTimeout(() => setSaved(false), 2500); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (err) => setBanner((err as Error).message),
  });

  function savePersonal() {
    saveM.mutate({
      display_name: form.display_name || undefined, bio: form.bio || undefined,
      date_of_birth: form.date_of_birth || undefined, gender: (form.gender || undefined) as ProfileIn["gender"],
      ethnicity: form.ethnicity || undefined, primary_language: form.primary_language || undefined,
      country: form.country || undefined, city: form.city || undefined,
    });
  }
  function savePayment() {
    saveM.mutate({
      payout_method: (payout.method || undefined) as PayoutMethod | undefined,
      payout_paypal: payout.paypal || undefined,
      payout_solana: payout.solana || undefined,
      payout_whop: payout.whop || undefined,
    });
  }

  if (ready && !token)
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Please sign in</h1>
        <Link href="/login" className="text-[var(--color-brand)] underline">Go to sign in</Link>
      </main>
    );

  if (!ready || !token || profileQ.isLoading || !seeded.current)
    return (
      <main className="mx-auto max-w-2xl px-6 py-10 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </main>
    );

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-brand)]">Creator workspace</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--color-text)]">Build your profile</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          Everything here is optional. The more you fill in, the more campaigns you get matched to.
        </p>
      </header>

      {/* tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)] no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setBanner(""); }}
            className={`shrink-0 cursor-pointer border-b-2 px-3 py-2.5 text-sm transition ${
              tab === t.key ? "border-[var(--color-brand)] text-[var(--color-text)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {banner ? (
        <div role="alert" className="rounded-[var(--radius-btn)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">{banner}</div>
      ) : null}

      {/* PERSONAL */}
      {tab === "personal" ? (
        <section className={cardCls}>
          <div className="flex items-center gap-4">
            <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text-muted)]">
              {localPreview ?? avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={(localPreview ?? avatarUrl)!} alt="Your avatar" className="h-full w-full object-cover" />
              ) : "No photo"}
              {avatarM.isPending ? (
                <span className="absolute inset-0 grid place-items-center bg-black/50">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className={labelCls}>Profile photo</label>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) pickAvatar(f); }} />
              <div className="w-40">
                <Button type="button" loading={avatarM.isPending} onClick={() => avatarInputRef.current?.click()}>
                  {(localPreview ?? avatarUrl) ? "Replace photo" : "Upload photo"}
                </Button>
              </div>
            </div>
          </div>

          <Field label="Display name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          <div className="space-y-2">
            <label className={labelCls}>Bio</label>
            <textarea rows={3} className={controlCls + " py-2"} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Date of birth" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            <div className="space-y-2">
              <label className={labelCls}>Gender</label>
              <select className={controlCls} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Select...</option>
                {GENDERS.map((g) => <option key={g} value={g}>{g.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <Field label="Primary language" value={form.primary_language} onChange={(e) => setForm({ ...form, primary_language: e.target.value })} />
            <Field label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            <Field label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Field label="Ethnicity" value={form.ethnicity} onChange={(e) => setForm({ ...form, ethnicity: e.target.value })} />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            {saved ? <span className="text-sm text-[var(--color-brand)]">Saved ✓</span> : null}
            <div className="w-32"><Button type="button" loading={saveM.isPending} onClick={savePersonal}>Save</Button></div>
          </div>
        </section>
      ) : null}

      {/* SOCIAL */}
      {tab === "social" ? (
        <section className={cardCls}>
          <p className="text-sm text-[var(--color-text-secondary)]">
            <span className="text-[var(--color-brand-soft)]">Creators with 3+ platforms get matched to more campaigns.</span> Add every account you post on.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PLATFORMS.map((p) => {
              const existing = socials.find((s) => s.platform === p);
              const isOpen = openPlatform === p;
              return (
                <div key={p} className={`rounded-[var(--radius-btn)] border p-3 transition ${existing ? "border-[var(--color-brand)]/40 bg-[var(--color-brand)]/5" : "border-[var(--color-border)]"}`}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-[var(--color-text)]">
                      <PlatformIcon name={p} className="h-4 w-4" /> {platformLabel(p)}
                    </span>
                    {existing ? (
                      <button className="cursor-pointer text-xs text-[var(--color-danger)]" onClick={() => removeSocialM.mutate(existing.id)}>Remove</button>
                    ) : (
                      <button className="cursor-pointer text-xs font-medium text-[var(--color-brand)]"
                        onClick={() => { setOpenPlatform(isOpen ? null : p); setSocialForm({ handle: "", profile_url: "", follower_count: "" }); }}>
                        {isOpen ? "Cancel" : "+ Add"}
                      </button>
                    )}
                  </div>
                  {existing ? (
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">@{existing.handle} · <span className="tabular">{existing.follower_count.toLocaleString()}</span> followers</p>
                  ) : isOpen ? (
                    <div className="mt-3 space-y-2">
                      <input className={controlCls + " text-sm"} placeholder="handle (without @)" value={socialForm.handle} onChange={(e) => setSocialForm({ ...socialForm, handle: e.target.value })} />
                      <input className={controlCls + " text-sm"} type="number" placeholder="follower count" value={socialForm.follower_count} onChange={(e) => setSocialForm({ ...socialForm, follower_count: e.target.value })} />
                      {addSocialM.isError ? <p className="text-xs text-[var(--color-danger)]">{(addSocialM.error as Error).message}</p> : null}
                      <Button type="button" loading={addSocialM.isPending} disabled={!socialForm.handle.trim()} onClick={() => addSocialM.mutate()}>Add {platformLabel(p)}</Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* PORTFOLIO */}
      {tab === "portfolio" ? (
        <section className={cardCls}>
          <p className="text-sm text-[var(--color-text-secondary)]">
            <span className="text-[var(--color-brand-soft)]">Boosts credibility with brands.</span> Paste a link to your best content (TikTok, Instagram, YouTube, X, or Facebook), no heavy uploads.
          </p>
          <ul className="space-y-2">
            {portfolio.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-btn)] border border-[var(--color-border)] px-3 py-2">
                <a href={p.video_url ?? "#"} target="_blank" rel="noreferrer" className="min-w-0 truncate text-sm text-[var(--color-brand)] hover:underline">
                  {p.brand_name ? `${p.brand_name} · ` : ""}{p.video_url}
                </a>
                <button className="shrink-0 cursor-pointer text-xs text-[var(--color-danger)]" onClick={() => removePortfolioM.mutate(p.id)}>Remove</button>
              </li>
            ))}
            {portfolio.length === 0 ? <li className="text-sm text-[var(--color-text-muted)]">No videos added yet.</li> : null}
          </ul>
          <div className="space-y-2">
            <input className={controlCls} placeholder="https://tiktok.com/@you/video/..." value={portfolioForm.video_url} onChange={(e) => setPortfolioForm({ ...portfolioForm, video_url: e.target.value })} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input className={controlCls + " text-sm"} placeholder="Brand (optional)" value={portfolioForm.brand_name} onChange={(e) => setPortfolioForm({ ...portfolioForm, brand_name: e.target.value })} />
              <input className={controlCls + " text-sm"} placeholder="Caption (optional)" value={portfolioForm.caption} onChange={(e) => setPortfolioForm({ ...portfolioForm, caption: e.target.value })} />
            </div>
            {addPortfolioM.isError ? <p className="text-sm text-[var(--color-danger)]">{(addPortfolioM.error as Error).message}</p> : null}
            <div className="w-40"><Button type="button" loading={addPortfolioM.isPending} disabled={!portfolioForm.video_url.trim()} onClick={() => addPortfolioM.mutate()}>Add video link</Button></div>
          </div>
        </section>
      ) : null}

      {/* PAYMENT */}
      {tab === "payment" ? (
        <section className={cardCls}>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Where should we send your earnings? Set this before requesting a payout.
          </p>
          <div className="space-y-2">
            <label className={labelCls}>Payout method</label>
            <div className="flex flex-wrap gap-2">
              {PAYOUT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayout({ ...payout, method: payout.method === m ? "" : m })}
                  className={`cursor-pointer rounded-full px-4 py-2 text-sm transition ${
                    payout.method === m ? "bg-[var(--color-brand)] text-[var(--color-on-brand)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {PAYOUT_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          {payout.method ? (
            <div className="space-y-2">
              <label className={labelCls}>{PAYOUT_LABEL[payout.method as PayoutMethod]} details</label>
              <input
                className={controlCls}
                placeholder={PAYOUT_PLACEHOLDER[payout.method as PayoutMethod]}
                value={payout[payout.method as PayoutMethod]}
                onChange={(e) => setPayout({ ...payout, [payout.method]: e.target.value } as typeof payout)}
              />
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-3 pt-2">
            {saved ? <span className="text-sm text-[var(--color-brand)]">Saved ✓</span> : null}
            <div className="w-32"><Button type="button" loading={saveM.isPending} onClick={savePayment}>Save</Button></div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
