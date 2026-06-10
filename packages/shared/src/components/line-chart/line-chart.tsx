import clsx from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";
import "./line-chart.scss";

const Y_TICKS = 3;
const POINT_RADIUS = 3;

export interface LineChartProps<T> {
  data: readonly T[];
  xKey: keyof T;
  yKey: keyof T;
  height: number;
  ariaLabel?: string;
  xLabel?: string;
  yLabel?: string;
  emptyState?: ReactNode;
  className?: string;
}

/**
 * Hand-rolled SVG line chart. Single-series only — multi-series and other chart kinds
 * (bar, scatter, area) are deferred until a sim needs them. Token-driven via CSS classes
 * that target the SVG primitives in `line-chart.scss`.
 */
export function LineChart<T extends Record<string, number | string>>({
  data,
  xKey,
  yKey,
  height,
  ariaLabel,
  xLabel,
  yLabel,
  emptyState,
  className,
}: LineChartProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Width tracked via ResizeObserver so the SVG viewBox matches the laid-out width (the Data
  // column flexes; the chart fills it). Guarded for jsdom which lacks ResizeObserver; tests
  // pass an explicit 0 width and only assert structure.
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

  if (data.length < 2) {
    return (
      <div
        ref={containerRef}
        className={clsx("line-chart-empty", className)}
        role="img"
        aria-label={ariaLabel}
        style={{ height }}
      >
        {emptyState ?? "No data"}
      </div>
    );
  }

  // Margins grow to make room for axis titles only when they're supplied, so the rotated
  // y-title / x-title never collide with the tick labels.
  const top = 12;
  const right = 14;
  const bottom = 24 + (xLabel ? 16 : 0);
  const left = 40 + (yLabel ? 18 : 0);
  const plotW = Math.max(0, width - left - right);
  const plotH = height - top - bottom;
  const yValues = data.map((d) => Number(d[yKey]));
  const yMax = Math.max(...yValues, 1);
  const xValues = data.map((d) => Number(d[xKey]));
  const xMin = xValues[0];
  const xMax = xValues[xValues.length - 1];
  const xRange = Math.max(1, xMax - xMin);

  // Build the polyline `points` attribute: "x1,y1 x2,y2 ..." in viewBox units.
  const points = data
    .map((d) => {
      const x = left + ((Number(d[xKey]) - xMin) / xRange) * plotW;
      const y = top + plotH - (Number(d[yKey]) / yMax) * plotH;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div
      ref={containerRef}
      className={clsx("line-chart", className)}
      role="img"
      aria-label={ariaLabel}
    >
      {/* The wrapping div is the labeled image region (role="img" + aria-label), so the SVG
          internals are aria-hidden — assistive tech announces the region's label atomically.
          The <title> still provides a hover tooltip when a label is supplied. */}
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width || 1} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {ariaLabel ? <title>{ariaLabel}</title> : null}

        {/* Y-axis gridlines + tick labels (0, max/2, max). No plot-border box and no tick
            marks — the full-width gridlines carry the structure (matches the design spec). */}
        {Array.from({ length: Y_TICKS }).map((_, i) => {
          const frac = i / (Y_TICKS - 1);
          const y = top + plotH - frac * plotH;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length tick array, index is stable
            <g key={`y-${i}`} className="line-chart-y-tick">
              <line className="line-chart-grid" x1={left} y1={y} x2={left + plotW} y2={y} />
              <text
                className="line-chart-y-tick-label"
                x={left - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {(yMax * frac).toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* X-axis start / end labels. */}
        <text
          className="line-chart-x-tick-label"
          x={left}
          y={top + plotH + 4}
          textAnchor="start"
          dominantBaseline="hanging"
        >
          {xMin}
        </text>
        <text
          className="line-chart-x-tick-label"
          x={left + plotW}
          y={top + plotH + 4}
          textAnchor="end"
          dominantBaseline="hanging"
        >
          {xMax}
        </text>

        {/* Series line. */}
        <polyline className="line-chart-series" points={points} fill="none" />

        {/* Point markers at each datum. */}
        {data.map((d, i) => (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: positional series, index is stable
            key={`pt-${i}`}
            className="line-chart-point"
            cx={left + ((Number(d[xKey]) - xMin) / xRange) * plotW}
            cy={top + plotH - (Number(d[yKey]) / yMax) * plotH}
            r={POINT_RADIUS}
          />
        ))}

        {/* X-axis title (centered below). */}
        {xLabel ? (
          <text
            className="line-chart-axis-title"
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
            className="line-chart-axis-title"
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
