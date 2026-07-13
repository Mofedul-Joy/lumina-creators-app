"use client";

import { useRef, useState } from "react";
import { adminUploadImage } from "@/lib/admin";
import { ImageCropModal } from "@/components/admin/ImageCropModal";

// The campaign banner is displayed wide, so we capture it wide: a 3:1 banner
// (recommended 1200×400). Admins drop or browse an image, crop it to the exact
// 3:1 region in a popup, and we upload the cropped result to R2. A URL can still
// be pasted. Leaving it blank is fine — the backend auto-fills a topic photo.
const BANNER_ASPECT = 3;              // 3:1 — the thumbnail's locked ratio
const ASPECT_LABEL = "3 : 1";
const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_MB = 10;

export function BannerInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [err, setErr] = useState("");

  function pickFile(file: File | undefined) {
    setErr("");
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Please choose an image file (PNG, JPG or WEBP)."); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setErr(`That image is over ${MAX_MB} MB — pick a smaller one.`); return; }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadCropped(blob: Blob) {
    setUploading(true);
    setErr("");
    try {
      const file = new File([blob], "banner.jpg", { type: "image/jpeg" });
      onChange(await adminUploadImage(file));
      setCropSrc(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Banner / thumbnail image (optional)</label>

      {value ? (
        // ── current banner preview (3:1) with quick actions ──
        <div className="group relative aspect-[3/1] w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Campaign banner" className="h-full w-full object-cover" />
          {uploading ? (
            <span className="absolute inset-0 grid place-items-center bg-black/50">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </span>
          ) : (
            <div className="absolute inset-0 flex items-end justify-end gap-2 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
              <button type="button" onClick={() => inputRef.current?.click()}
                className="cursor-pointer rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-white">Replace</button>
              <button type="button" onClick={() => onChange("")}
                className="cursor-pointer rounded-lg bg-black/60 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black/80">Remove</button>
            </div>
          )}
        </div>
      ) : (
        // ── empty dropzone (banner-shaped) ──
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
          className={`flex aspect-[3/1] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition ${
            dragOver ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5" : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-brand)]/60"
          }`}
        >
          {uploading ? (
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-brand)]/30 border-t-[var(--color-brand)]" />
          ) : (
            <>
              <svg className="h-8 w-8 text-[var(--color-text-muted)]" viewBox="0 0 24 24" fill="none"><path d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <p className="text-sm font-medium text-[var(--color-text)]">Drag &amp; drop a banner, or click to browse</p>
              <p className="text-xs text-[var(--color-text-muted)]">PNG, JPG or WEBP · recommended <b className="text-[var(--color-text-secondary)]">1200 × 400</b> ({ASPECT_LABEL}) · up to {MAX_MB} MB</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">You&apos;ll crop it to the banner shape next.</p>
            </>
          )}
        </button>
      )}

      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
             onChange={(e) => { pickFile(e.target.files?.[0]); e.currentTarget.value = ""; }} />

      {/* paste-a-URL escape hatch */}
      <div className="mt-2 flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="…or paste an image URL"
          className="min-h-9 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
        />
      </div>
      <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Leave blank and we&apos;ll auto-pick a photo that matches your campaign.</p>
      {err ? <p className="mt-1 text-xs text-[var(--color-danger)]">{err}</p> : null}

      {cropSrc ? (
        <ImageCropModal
          src={cropSrc}
          aspect={BANNER_ASPECT}
          aspectLabel={ASPECT_LABEL}
          onCancel={() => setCropSrc(null)}
          onCropped={uploadCropped}
        />
      ) : null}
    </div>
  );
}
