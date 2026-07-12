"use client";

import { useId, type InputHTMLAttributes } from "react";

import { InfoTip } from "@/components/ui/InfoTip";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  requiredMark?: boolean;
  hint?: string;
};

export function Field({ id, label, error, requiredMark, hint, className = "", ...props }: FieldProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text)]"
      >
        {label}
        {requiredMark ? <span className="ml-0.5 text-[var(--color-danger)]">*</span> : null}
        {hint ? <InfoTip text={hint} /> : null}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? errorId : undefined}
        className={`min-h-11 w-full rounded-[var(--radius-btn)] border bg-[var(--color-surface-2)] px-3 text-base text-[var(--color-text)] outline-none transition duration-200 placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] ${
          error ? "border-[var(--color-danger)]" : "border-[var(--color-border)]"
        } ${className}`}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
