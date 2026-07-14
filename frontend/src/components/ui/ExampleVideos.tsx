// Example videos grid on a campaign's Explore overview + brief pages. Each tile
// is a clickable thumbnail (cached on our storage, fetched once) that opens the
// real post on the social platform. Falls back to a play tile when a thumbnail
// hasn't resolved yet (or for uploaded files with no social thumbnail).
import { PlatformIcon } from "@/components/ui/PlatformIcon";

export type ExampleVideo = { url: string; platform?: string | null; thumbnail_url?: string | null };

export function ExampleVideos({ examples, urls }: { examples?: ExampleVideo[]; urls?: string[] }) {
  const items: ExampleVideo[] = examples?.length ? examples : (urls ?? []).map((url) => ({ url }));
  if (!items.length) return null;
  const shown = items.slice(0, 5);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {shown.map((v, i) => (
        <a
          key={`${v.url}-${i}`}
          href={v.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-[var(--radius-btn)] border border-[var(--color-border)] bg-[var(--color-surface-2)] transition hover:border-[var(--color-brand)]/60"
        >
          {v.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.03]" />
          ) : null}
          <span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition group-hover:scale-105">
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          {v.platform ? (
            <span className="absolute left-1.5 top-1.5 z-10 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white">
              <PlatformIcon name={v.platform} className="h-3 w-3" />
            </span>
          ) : null}
        </a>
      ))}
    </div>
  );
}

export default ExampleVideos;
