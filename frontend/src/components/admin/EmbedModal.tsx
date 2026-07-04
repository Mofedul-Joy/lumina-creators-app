"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

export function EmbedModal({ embedUrl, postUrl, onClose }: { embedUrl: string; postUrl: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="card-lumina w-full max-w-md overflow-hidden rounded-[var(--radius-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
          <a href={postUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-brand)]">
            Open original post ↗
          </a>
          <button
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-md px-2 py-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            ✕
          </button>
        </div>
        <div className="aspect-[9/16] max-h-[70vh] w-full bg-black">
          <iframe
            src={embedUrl}
            className="h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
