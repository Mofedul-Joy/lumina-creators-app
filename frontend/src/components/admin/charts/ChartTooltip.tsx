"use client";

import type { ReactNode } from "react";

/**
 * Floating tooltip that follows the cursor inside a chart.
 *
 * Positioned against the chart's own bounding box (the parent must be
 * `relative`), and flipped to the other side of the cursor near the right edge
 * so it never gets clipped by the card.
 */
export function ChartTooltip({
  x,
  y,
  width,
  children,
}: {
  x: number;          // cursor x within the chart box
  y: number;          // cursor y within the chart box
  width: number;      // chart box width, for edge flipping
  children: ReactNode;
}) {
  const FLIP_MARGIN = 150;
  const flip = x > width - FLIP_MARGIN;
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[120px] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 shadow-xl"
      style={{
        left: x,
        top: y,
        transform: `translate(${flip ? "calc(-100% - 14px)" : "14px"}, -50%)`,
      }}
    >
      {children}
    </div>
  );
}
