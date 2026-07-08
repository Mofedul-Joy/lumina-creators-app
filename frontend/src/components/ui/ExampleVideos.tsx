// Example videos grid (Feature 3 wizard) rendered on the native brief page
// (Feature 5) — up to 3 clickable tiles linking out to the reference clips.

export function ExampleVideos({ urls }: { urls: string[] }) {
  if (!urls || urls.length === 0) return null;
  const shown = urls.slice(0, 3);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {shown.map((url, i) => (
        <a
          key={`${url}-${i}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] transition hover:border-[var(--color-brand)]/50"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-brand)]/90 text-[var(--color-on-brand)] transition group-hover:scale-105">
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="absolute bottom-2 left-2 right-2 truncate text-[11px] text-[var(--color-text-secondary)]">
            Example {i + 1}
          </span>
        </a>
      ))}
    </div>
  );
}

export default ExampleVideos;
