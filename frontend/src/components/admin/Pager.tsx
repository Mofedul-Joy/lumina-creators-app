// Numbered page circles + Prev/Next, matching the feedback mock. Client-side:
// the caller slices its data by (page-1)*pageSize.
function windowed(page: number, count: number, span = 5): number[] {
  const half = Math.floor(span / 2);
  let start = Math.max(1, page - half);
  const end = Math.min(count, start + span - 1);
  start = Math.max(1, end - span + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function Pager({
  page,
  pageCount,
  onPage,
  total,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
  total?: number;
}) {
  if (pageCount <= 1) return null;
  const circle = "grid h-8 w-8 place-items-center rounded-full text-sm transition cursor-pointer";
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        {windowed(page, pageCount).map((p) => (
          <button
            key={p}
            onClick={() => onPage(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${circle} ${
              p === page
                ? "bg-[var(--color-brand)] font-semibold text-[var(--color-on-brand)]"
                : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            }`}
          >
            {p}
          </button>
        ))}
        {total !== undefined ? (
          <span className="ml-2 text-xs text-[var(--color-text-muted)]">{total} total</span>
        ) : null}
      </div>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="cursor-pointer rounded-full px-3.5 py-1.5 text-sm text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-[var(--color-text)] disabled:cursor-default disabled:opacity-40"
        >
          Prev
        </button>
        <button
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          className="cursor-pointer rounded-full px-3.5 py-1.5 text-sm text-[var(--color-text-secondary)] ring-1 ring-inset ring-[var(--color-border)] hover:text-[var(--color-text)] disabled:cursor-default disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
