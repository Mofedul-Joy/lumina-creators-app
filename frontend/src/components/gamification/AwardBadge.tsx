// Award badge tile (Feature 7) — 4 known awards, bright when earned, greyed
// + grayscale when locked. Icon + label + description tooltip via `title`.
export const AWARD_META: Record<string, { label: string; icon: string; description: string }> = {
  persistent_pro: {
    label: "Persistent Pro",
    icon: "\u{1F525}",
    description: "Post at least one clip a day for 7 days in a row.",
  },
  gig_completion_mastery: {
    label: "Gig Completion Mastery",
    icon: "\u{1F3AF}",
    description: "Complete 10 or more submissions.",
  },
  earnings_mastery: {
    label: "Earnings Mastery",
    icon: "\u{1F4B0}",
    description: "Earn $500 or more in total payouts.",
  },
  interview_mastery: {
    label: "Interview Mastery",
    icon: "\u{1F3A4}",
    description: "Awarded manually by an admin after an interview.",
  },
};

export function AwardBadge({
  award,
  earned,
  size = "md",
}: {
  award: string;
  earned: boolean;
  size?: "sm" | "md";
}) {
  const meta = AWARD_META[award] ?? { label: award, icon: "\u{1F3C6}", description: "" };
  const pad = size === "sm" ? "p-2" : "p-3";
  return (
    <div
      title={meta.description}
      className={`rounded-xl border text-center transition ${pad} ${
        earned
          ? "border-[var(--color-brand)]/50 bg-[var(--color-brand)]/10"
          : "border-[var(--color-border)] bg-[var(--color-surface-2)] opacity-50 grayscale"
      }`}
    >
      <p className={size === "sm" ? "text-lg" : "text-xl"}>{meta.icon}</p>
      <p
        className={`mt-1 font-medium ${size === "sm" ? "text-[9px]" : "text-[10px]"} ${
          earned ? "text-[var(--color-brand)]" : "text-[var(--color-text-muted)]"
        }`}
      >
        {meta.label}
      </p>
    </div>
  );
}

/** Renders all 4 known awards in a row, marking which ones the creator has earned. */
export function AwardRow({ awards, size = "md" }: { awards: string[]; size?: "sm" | "md" }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {Object.keys(AWARD_META).map((key) => (
        <AwardBadge key={key} award={key} earned={awards.includes(key)} size={size} />
      ))}
    </div>
  );
}

export default AwardBadge;
