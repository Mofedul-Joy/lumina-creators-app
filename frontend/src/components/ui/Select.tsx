"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// A clean, themed dropdown to replace the browser's native <select> (whose
// option list is drawn by the OS and looks dated). Fully styled, keyboard
// accessible, closes on outside-click / Escape, and animates open. Drop-in:
// pass value + onChange + options, same as a controlled select.
export type SelectOption = { value: string; label: string; disabled?: boolean };

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  id,
  disabled,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);   // keyboard-highlighted index
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // When opening, highlight the current selection and scroll it into view.
  useEffect(() => {
    if (!open) return;
    const i = options.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
  }, [open, options, value]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function commit(i: number) {
    const opt = options[i];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); commit(active); }
    else if (e.key === "Tab") { setOpen(false); }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKey}
        className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border bg-[var(--color-surface-2)] px-3.5 text-left text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? "border-[var(--color-brand)]" : "border-[var(--color-border)] hover:border-[var(--color-brand)]/60"
        }`}
      >
        <span className={selected ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-deep)] p-1 shadow-2xl ring-1 ring-black/5"
        >
          {options.map((o, i) => {
            const isSel = o.value === value;
            const isActive = i === active;
            return (
              <li key={o.value || `opt-${i}`} role="option" aria-selected={isSel}>
                <button
                  type="button"
                  disabled={o.disabled}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(i)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition disabled:opacity-40 ${
                    isActive ? "bg-[var(--color-surface)]" : ""
                  } ${isSel ? "text-[var(--color-brand-soft)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
                >
                  <span className="truncate">{o.label}</span>
                  {isSel ? (
                    <svg className="h-4 w-4 shrink-0 text-[var(--color-brand)]" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
