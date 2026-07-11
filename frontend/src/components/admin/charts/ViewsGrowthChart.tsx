"use client";

import { useRef, useState } from "react";
import { fmtInt } from "@/lib/format";
import { ChartTooltip } from "./ChartTooltip";

export type ViewsPoint = { date: string; views: number };

const W = 600;   // viewBox units — the SVG scales to its container
const H = 180;
const PAD_L = 8;
const PAD_B = 18;

/**
 * Views Growth — an area/line of daily view totals. Hovering snaps to the
 * nearest day, drops a crosshair, and shows a tooltip that follows the cursor.
 */
export function ViewsGrowthChart({ data }: { data: ViewsPoint[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number; w: number } | null>(null);

  const max = Math.max(1, ...data.map((d) => d.views));
  const n = data.length;

  const px = (i: number) => PAD_L + (i / Math.max(1, n - 1)) * (W - PAD_L * 2);
  const py = (v: number) => (H - PAD_B) - (v / max) * (H - PAD_B - 10);

  const line = data.map((d, i) => `${px(i)},${py(d.views)}`).join(" ");
  const area = `${PAD_L},${H - PAD_B} ${line} ${px(n - 1)},${H - PAD_B}`;

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const rel = (e.clientX - box.left) / box.width;          // 0..1 across the box
    const i = Math.round(rel * (n - 1));
    setHover({
      i: Math.min(n - 1, Math.max(0, i)),
      x: e.clientX - box.left,
      y: e.clientY - box.top,
      w: box.width,
    });
  }

  const point = hover ? data[hover.i] : null;
  const empty = data.every((d) => d.views === 0);

  const fmtDay = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Views Growth</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Visibility trends over time</p>
        </div>
        {n > 0 ? (
          <span className="shrink-0 rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-secondary)]">
            {fmtDay(data[0].date)} → {fmtDay(data[n - 1].date)}
          </span>
        ) : null}
      </div>

      <div ref={boxRef} className="relative mt-5" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="vg-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 0.5, 1].map((f) => (
            <line
              key={f}
              x1={0} x2={W}
              y1={(H - PAD_B) - f * (H - PAD_B - 10)}
              y2={(H - PAD_B) - f * (H - PAD_B - 10)}
              stroke="var(--color-border)" strokeWidth="1" opacity="0.5"
            />
          ))}

          <polygon points={area} fill="url(#vg-fill)" />
          <polyline
            points={line}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {hover && point ? (
            <>
              <line
                x1={px(hover.i)} x2={px(hover.i)} y1={6} y2={H - PAD_B}
                stroke="var(--color-text-muted)" strokeWidth="1" strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
              <circle cx={px(hover.i)} cy={py(point.views)} r="4" fill="#22c55e" stroke="#04150b" strokeWidth="2" />
            </>
          ) : null}
        </svg>

        {/* x labels — first, middle, last only; 7 dates would collide */}
        <div className="flex justify-between px-1 text-[10px] text-[var(--color-text-muted)]">
          <span>{n ? fmtDay(data[0].date) : ""}</span>
          <span>{n > 2 ? fmtDay(data[Math.floor(n / 2)].date) : ""}</span>
          <span>{n ? fmtDay(data[n - 1].date) : ""}</span>
        </div>

        {/* Views history only exists from the first scrape after snapshots shipped —
            say that plainly instead of implying the creator has zero reach. */}
        {empty ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <p className="rounded-full bg-[var(--color-surface-2)]/90 px-3 py-1 text-xs text-[var(--color-text-muted)]">
              No view history yet
            </p>
          </div>
        ) : null}

        {hover && point && !empty ? (
          <ChartTooltip x={hover.x} y={hover.y} width={hover.w}>
            <p className="text-xs font-semibold text-[var(--color-text)]">{fmtDay(point.date)}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
              <span className="h-2 w-2 rounded-full bg-[var(--color-brand)]" />
              <span className="tabular text-[var(--color-text)]">{fmtInt(point.views)}</span> views
            </p>
          </ChartTooltip>
        ) : null}
      </div>
    </div>
  );
}
