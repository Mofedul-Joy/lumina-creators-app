// Flame + streak-day count (Feature 7). Green tint when active (>=1 day),
// grey when the streak is 0 — no orange/red flame to stay green-first.
export function StreakFlame({ days, size = "md" }: { days: number; size?: "sm" | "md" | "lg" }) {
  const active = days >= 1;
  const textSize = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base";
  const iconSize = size === "lg" ? 22 : size === "sm" ? 14 : 18;
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold ${textSize} ${
        active ? "text-[var(--color-brand)]" : "text-[var(--color-text-muted)]"
      }`}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c0-1-.3-2-1-3 2 1 3 3.5 3 6a8 8 0 1 1-16 0c0-4 2.5-6.5 4-8.5C9 5 10 3.5 12 2Z"
          fill={active ? "var(--color-brand)" : "currentColor"}
          fillOpacity={active ? 0.9 : 0.25}
          stroke={active ? "var(--color-brand)" : "currentColor"}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      {days}-day streak
    </span>
  );
}

export default StreakFlame;
