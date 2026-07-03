// Shared status pill for the admin console. Palette mirrors the Lumina Clippers
// admin (emerald = good/verified/paid, red = rejected/failed, amber = pending).
const STYLES: Record<string, string> = {
  verified: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/25",
  stats_verified: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/25",
  paid: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/25",
  success: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/25",
  active: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/25",
  pending: "bg-amber-500/15 text-amber-400 ring-amber-500/25",
  awaiting_stats: "bg-amber-500/15 text-amber-400 ring-amber-500/25",
  requested: "bg-amber-500/15 text-amber-400 ring-amber-500/25",
  proof_uploaded: "bg-sky-500/15 text-sky-400 ring-sky-500/25",
  draft: "bg-white/10 text-[var(--color-text-muted)] ring-white/10",
  archived: "bg-white/5 text-[var(--color-text-muted)] ring-white/10",
  rejected: "bg-red-500/15 text-red-400 ring-red-500/25",
  failed: "bg-red-500/15 text-red-400 ring-red-500/25",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STYLES[status] ?? "bg-white/10 text-[var(--color-text-muted)] ring-white/10";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
