import clsx from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { histogramBins, niceStep } from "./histogram-bins";
import "./histogram.scss";

const DEFAULT_BIN_COUNT = 7;
const Y_TICKS = 3;
const BAR_GAP_PX = 2;

export interface HistogramProps {
  values: readonly number[];
  targetBinCount?: number;
  height: number;
  ariaLabel?: string;
  xLabel?: string;
  yLabel?: string;
  emptyState?: ReactNode;
  className?: string;
}

/**
 * Hand-rolled SVG histogram. Auto-bins raw `values` into round-width bins using `histogramBins`
 * / `niceStep` (co-located in `./histogram-bins`). The y-axis maximum is also `niceStep`-rounded so
 * the gridlines land on clean integers. Visual language matches `<LineChart>` (full-width
 * gridlines, no plot-border box) so the two read consistently side by side.
 */
export function Histogram({
  values,
  targetBinCount = DEFAULT_BIN_COUNT,
  height,
  ariaLabel,
  xLabel,
  yLabel,
  emptyState,
  className,
}: HistogramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.round(entries[0].contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Applied to the rendered SVG chart only (below), never the empty state. Exposes the chart as a
  // labeled image, but ONLY when there's an accessible name to give it: a role="img" with no label
  // is an unlabeled image (WCAG 1.1.1), and a role-less <div> must not carry aria-label. One spread
  // so role + aria-label always travel together (or neither — then the chart reads as decorative,
  // its inner SVG already aria-hidden).
  const imgProps = ariaLabel ? { role: "img" as const, "aria-label": ariaLabel } : {};

  // Empty state: a plain text placeholder, NOT an image — there's no SVG here. role="img" is atomic
  // (screen readers announce the label and skip descendant text), so it would swallow the visible
  // "No data" message. Left unroled, the message is announced; the chart's identity comes from the
  // surrounding heading (consumers wrap these in a <DataSubsection>).
  if (values.length === 0) {
    return (
      <div ref={containerRef} className={clsx("histogram-empty", className)} style={{ height }}>
        {emptyState ?? "No data"}
      </div>
    );
  }

  const { counts, binWidth } = histogramBins(values, targetBinCount);
  const maxCount = Math.max(...counts, 1);
  const yMax = niceStep(maxCount);
  // Margins grow to make room for axis titles only when they're supplied.
  const top = 12;
  const right = 14;
  const bottom = 24 + (xLabel ? 16 : 0);
  const left = 40 + (yLabel ? 9 : 0);
  const plotW = Math.max(0, width - left - right);
  const plotH = height - top - bottom;
  const barWidth = plotW / counts.length;

  return (
    <div ref={containerRef} className={clsx("histogram", className)} {...imgProps}>
      {/* The wrapping div is the labeled image region; the SVG internals are aria-hidden so
          assistive tech announces the region's label atomically (see LineChart). */}
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width || 1} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {ariaLabel ? <title>{ariaLabel}</title> : null}

        {/* Y-axis gridlines + tick labels (0 / yMax/2 / yMax). No box, no tick marks. */}
        {Array.from({ length: Y_TICKS }).map((_, i) => {
          const frac = i / (Y_TICKS - 1);
          const y = top + plotH - frac * plotH;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length tick array, index is stable
            <g key={`y-${i}`}>
              <line className="histogram-grid" x1={left} y1={y} x2={left + plotW} y2={y} />
              <text
                className="histogram-y-tick-label"
                x={left - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {Math.round(yMax * frac)}
              </text>
            </g>
          );
        })}

        {/* Bars — skip empty bins so 0-count bins don't render a hairline. */}
        {counts.map((count, i) => {
          if (count === 0) return null;
          const h = (count / yMax) * plotH;
          return (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: positional bins, index is stable
              key={`bar-${i}`}
              className="histogram-bar"
              x={left + i * barWidth + BAR_GAP_PX / 2}
              y={top + plotH - h}
              width={barWidth - BAR_GAP_PX}
              height={h}
            />
          );
        })}

        {/* X-axis labels at every bin boundary (one more label than bin count). */}
        {Array.from({ length: counts.length + 1 }).map((_, i) => (
          <text
            // biome-ignore lint/suspicious/noArrayIndexKey: positional boundaries, index is stable
            key={`x-${i}`}
            className="histogram-x-tick-label"
            x={left + (i / counts.length) * plotW}
            y={top + plotH + 4}
            textAnchor="middle"
            dominantBaseline="hanging"
          >
            {Number((i * binWidth).toPrecision(12))}
          </text>
        ))}

        {/* X-axis title (centered below). */}
        {xLabel ? (
          <text
            className="histogram-axis-title"
            x={left + plotW / 2}
            y={height - 4}
            textAnchor="middle"
          >
            {xLabel}
          </text>
        ) : null}

        {/* Y-axis title (rotated up the left edge). */}
        {yLabel ? (
          <text
            className="histogram-axis-title"
            x={0}
            y={0}
            textAnchor="middle"
            transform={`translate(14, ${top + plotH / 2}) rotate(-90)`}
          >
            {yLabel}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
