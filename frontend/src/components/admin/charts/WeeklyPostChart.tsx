"use client";

import { useRef, useState } from "react";
import { ChartTooltip } from "./ChartTooltip";

export type WeeklyPostPoint = {
  day: string;        // Mon..Sun
  date: string;       // ISO date of THIS week's matching weekday
  this_week: number;
  last_week: number;
};

const THIS_WEEK = "#22c55e";
const LAST_WEEK = "#f59e0b";

/**
 * Weekly Post Overview — grouped bars per weekday, this week vs last week.
 * Hovering anywhere in a weekday column shows a tooltip that follows the cursor.
 */
export function WeeklyPostChart({ data }: { data: WeeklyPostPoint[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number; w: number } | null>(null);

  const max = Math.max(1, ...data.flatMap((d) => [d.this_week, d.last_week]));
  // A whole number of gridlines — a "2.5 posts" axis label would be nonsense.
  const ticks = Array.from({ length: Math.min(max, 4) + 1 }, (_, i) =>
    Math.round((max / Math.min(max, 4)) * i),
  );

  function onMove(e: React.MouseEvent<HTMLDivElement>, i: number) {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    setHover({ i, x: e.clientX - box.left, y: e.clientY - box.top, w: box.width });
  }

  const point = hover ? data[hover.i] : null;

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Weekly Post Overview</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Track what&apos;s resonating this week
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs text-[var(--color-text-secondary)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: THIS_WEEK }} /> This week
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: LAST_WEEK }} /> Last week
          </span>
        </div>
      </div>

      <div ref={boxRef} className="relative mt-5" onMouseLeave={() => setHover(null)}>
        {/* gridlines + y labels */}
        <div className="flex">
          <div className="flex w-7 shrink-0 flex-col-reverse justify-between pr-2 text-right text-[10px] text-[var(--color-text-muted)]" style={{ height: 168 }}>
            {ticks.map((t, i) => <span key={i}>{t}</span>)}
          </div>
          <div className="relative flex-1" style={{ height: 168 }}>
            {ticks.map((_, i) => (
              <div
                key={i}
                className="absolute inset-x-0 border-t border-[var(--color-border)]/50"
                style={{ bottom: `${(i / (ticks.length - 1)) * 100}%` }}
              />
            ))}

            {/* one hover column per weekday */}
            <div className="absolute inset-0 flex">
              {data.map((d, i) => (
                <div
                  key={d.day}
                  onMouseMove={(e) => onMove(e, i)}
                  className={`group relative flex flex-1 items-end justify-center gap-1 ${
                    hover?.i === i ? "bg-[var(--color-surface-2)]/40" : ""
                  }`}
                >
                  {/* A zero bar still gets a 2px stub so the day reads as present-but-empty. */}
                  <span
                    className="w-2.5 rounded-t-sm transition-opacity"
                    style={{
                      background: THIS_WEEK,
                      height: `${Math.max(2, (d.this_week / max) * 100)}%`,
                      opacity: hover && hover.i !== i ? 0.4 : 1,
                    }}
                  />
                  <span
                    className="w-2.5 rounded-t-sm transition-opacity"
                    style={{
                      background: LAST_WEEK,
                      height: `${Math.max(2, (d.last_week / max) * 100)}%`,
                      opacity: hover && hover.i !== i ? 0.4 : 1,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* x labels */}
        <div className="ml-7 flex">
          {data.map((d) => (
            <span key={d.day} className="flex-1 pt-2 text-center text-[10px] text-[var(--color-text-muted)]">
              {d.day}
            </span>
          ))}
        </div>

        {hover && point ? (
          <ChartTooltip x={hover.x} y={hover.y} width={hover.w}>
            <p className="text-xs font-semibold text-[var(--color-text)]">
              {new Date(`${point.date}T00:00:00`).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
            <p className="mt-1.5 flex items-center justify-between gap-4 text-xs text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: THIS_WEEK }} /> This week
              </span>
              <span className="tabular text-[var(--color-text)]">{point.this_week}</span>
            </p>
            <p className="mt-1 flex items-center justify-between gap-4 text-xs text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: LAST_WEEK }} /> Last week
              </span>
              <span className="tabular text-[var(--color-text)]">{point.last_week}</span>
            </p>
          </ChartTooltip>
        ) : null}
      </div>
    </div>
  );
}
