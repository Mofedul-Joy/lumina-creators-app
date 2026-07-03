// Profile photo with an initial fallback. Used on creator cards + detail.
export function Avatar({ url, name, size = 40 }: { url?: string | null; name?: string | null; size?: number }) {
  const initial = ((name ?? "").trim().slice(0, 1) || "?").toUpperCase();
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--color-surface-2)] font-semibold text-[var(--color-text-secondary)]"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}
