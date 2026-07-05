// Shimmer skeleton placeholders shown while data loads, instead of bare
// "Loading..." text. `animate-pulse` is enough of a shimmer against the dark
// surface without adding custom keyframes.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--color-surface-2)] ${className}`} />;
}

// A campaign/submission card placeholder: image block + a few text lines.
export function SkeletonCard() {
  return (
    <div className="card-lumina overflow-hidden rounded-[var(--radius-card)]">
      <Skeleton className="h-32 w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-7 w-24" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-12" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonCardGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

// A stat-tile placeholder row.
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-grad rounded-[var(--radius-card)] p-5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-3 h-8 w-24" />
        </div>
      ))}
    </div>
  );
}
