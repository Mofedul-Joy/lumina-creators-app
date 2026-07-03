"use client";

import { useRef, useState } from "react";
import { adminUploadImage } from "@/lib/admin";

// Campaign banner/thumbnail: paste an image URL OR upload one from the computer
// (uploaded to R2, stored back as a URL). Either way the value is an image URL.
export function BannerInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function upload(file: File) {
    setErr("");
    setUploading(true);
    try {
      onChange(await adminUploadImage(file));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm text-[var(--color-text)]">Banner / thumbnail image (optional)</label>
      <div className="flex gap-3">
        <div className="relative grid h-16 w-28 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs text-[var(--color-text-muted)]">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            "No image"
          )}
          {uploading ? (
            <span className="absolute inset-0 grid place-items-center bg-black/50">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </span>
          ) : null}
        </div>
        <div className="flex-1 space-y-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste an image URL…"
            className="min-h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
          />
          <div className="flex items-center gap-3">
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="cursor-pointer rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)] disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "⇧ Upload from computer"}
            </button>
            <span className="text-xs text-[var(--color-text-muted)]">or paste a link above</span>
          </div>
          {err ? <p className="text-xs text-[var(--color-danger)]">{err}</p> : null}
        </div>
      </div>
    </div>
  );
}
