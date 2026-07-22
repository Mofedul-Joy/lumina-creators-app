"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { type Area } from "react-easy-crop";
import type CropperComponent from "react-easy-crop";

// react-easy-crop is ~15 kB and only needed once this modal actually opens (a
// deliberate click on "upload photo"/"upload banner"). Loading it lazily keeps
// it out of the initial bundle of every page that merely *can* crop an image
// (account, onboarding, the campaign builder), which are otherwise the app's
// heaviest routes. The cast restores the component's own prop typing, which
// next/dynamic's generic wrapper otherwise widens (dropping defaultProps).
const Cropper = dynamic(() => import("react-easy-crop"), { ssr: false }) as unknown as typeof CropperComponent;

// Crop an uploaded image to a fixed aspect ratio. The crop frame's ratio is
// locked (it IS the thumbnail's ratio) — the admin pans and zooms to pick the
// exact region, but can never distort it. Returns a Blob of the cropped image.
async function getCroppedBlob(src: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the image");
  ctx.drawImage(
    img, area.x, area.y, area.width, area.height,
    0, 0, area.width, area.height,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed"))), "image/jpeg", 0.92),
  );
}

export function ImageCropModal({
  src, aspect, aspectLabel, onCancel, onCropped,
}: {
  src: string;
  aspect: number;
  aspectLabel: string;
  onCancel: () => void;
  onCropped: (blob: Blob) => Promise<void> | void;
}) {
  const [mounted, setMounted] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setMounted(true), []);

  const onComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  async function confirm() {
    if (!area) return;
    setBusy(true);
    setError("");
    try {
      const blob = await getCroppedBlob(src, area);
      await onCropped(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not crop that image");
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">Crop your banner</p>
            <p className="text-xs text-[var(--color-text-muted)]">Drag to reposition, scroll or use the slider to zoom. The frame is locked to {aspectLabel}.</p>
          </div>
          <button onClick={onCancel} aria-label="Cancel" className="cursor-pointer rounded-full p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="relative h-[320px] w-full bg-black">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onComplete}
            showGrid
            restrictPosition
          />
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--color-border)] px-5 py-3">
          <span className="text-xs text-[var(--color-text-muted)]">Zoom</span>
          <input
            type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[var(--color-brand)]"
            aria-label="Zoom"
          />
        </div>

        {error ? <p className="px-5 pb-1 text-sm text-[var(--color-danger)]">{error}</p> : null}

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4">
          <button onClick={onCancel} className="cursor-pointer rounded-full px-4 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">Cancel</button>
          <button
            onClick={confirm}
            disabled={busy || !area}
            className="cursor-pointer rounded-full bg-[var(--color-brand)] px-5 py-1.5 text-sm font-semibold text-[var(--color-on-brand)] transition hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Uploading…" : "Crop & use"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
