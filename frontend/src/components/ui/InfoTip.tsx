"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * A small "i" info button that reveals a short explanation on hover, keyboard
 * focus, or tap. Used to explain admin/creator form fields inline without
 * cluttering the layout. Theme-aware (light-on-dark / dark-on-light) and
 * dismissible on outside click / Escape so it works on touch too.
 */
export function InfoTip({ text, label = "More info", className = "" }: { text: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[10px] font-semibold leading-none text-[var(--color-text-secondary)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] focus-visible:border-[var(--color-brand)] focus-visible:text-[var(--color-brand)] focus-visible:outline-none"
      >
        i
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-normal leading-relaxed text-[var(--color-text)] shadow-lg"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
