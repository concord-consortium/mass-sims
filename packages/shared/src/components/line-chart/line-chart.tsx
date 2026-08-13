import clsx from "clsx";
import { type ReactNode, useEffect, useRef, useState } from "react";
import "./line-chart.scss";

const Y_TICKS = 3;
const POINT_RADIUS = 3;

export interface LineChartProps<T> {
  /** Series data, sorted ascending by `xKey`. */
  data: readonly T[];
  xKey: keyof T;
  yKey: keyof T;
  height: number;
  ariaLabel?: string;
  xLabel?: string;
  yLabel?: string;
  /** Plot the x axis descending (max at left, min at right). Data still passed sorted ascending. */
  xReversed?: boolean;
  /** Plot the y axis descending (max at bottom, min at top). */
  yReversed?: boolean;
  /** Emphasize the datum at these axis values (e.g. a selected table row). */
  highlightX?: number;
  highlightY?: number;
  emptyState?: ReactNode;
  className?: string;
}

/**
 * Hand-rolled SVG line chart. Single-series only — multi-series and other chart kinds
 * (bar, scatter, area) are deferred until a sim needs them. Token-driven via CSS classes
 * that target the SVG primitives in `line-chart.scss`.
 *
 * **`data` must be sorted ascending by `xKey`.** The line connects points in array order and
 * the x-axis range is taken from the first/last datum, so unsorted input renders incorrectly
 * (zigzag line and/or wrong axis bounds). A line chart is x-ordered by nature; the only
 * consumer (the Starter) builds its series in frame order.
 */
export function LineChart<T extends Record<string, number | string>>({
  data,
  xKey,
  yKey,
  height,
  ariaLabel,
  xLabel,
  yLabel,
  xReversed,
  yReversed,
  highlightX,
  highlightY,
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

  const yValues = data.map((d) => Number(d[yKey]));
  const yMax = Math.max(...yValues, 1);
  // Tick labels round to at most 2 decimals (raw floats are noise) with digit grouping.
  const formatTick = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  // Margins grow to fit the content: the left margin tracks the widest y-tick label so large
  // numbers never clip at the edge or collide with the rotated y-title; top/bottom make room
  // for the axis titles only when they're supplied.
  const top = 12;
  const right = 14;
  const bottom = 24 + (xLabel ? 16 : 0);
  const yTickLabelW = formatTick(yMax).length * 6.5; // ~6.5px per character at the tick font size
  const left = (yLabel ? 20 : 4) + yTickLabelW + 8;
  const plotW = Math.max(0, width - left - right);
  const plotH = height - top - bottom;
  const xValues = data.map((d) => Number(d[xKey]));
  const xMin = xValues[0];
  const xMax = xValues[xValues.length - 1];
  const xRange = Math.max(1, xMax - xMin);

  // Map a data value to a pixel position, optionally reversing the axis direction.
  const xPos = (v: number) => {
    const t = (v - xMin) / xRange;
    return left + (xReversed ? 1 - t : t) * plotW;
  };
  const yPos = (v: number) => {
    const t = v / yMax;
    return yReversed ? top + t * plotH : top + plotH - t * plotH;
  };

  // Build the polyline `points` attribute: "x1,y1 x2,y2 ..." in viewBox units.
  const points = data
    .map((d) => `${xPos(Number(d[xKey])).toFixed(2)},${yPos(Number(d[yKey])).toFixed(2)}`)
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

        {/* Y-axis gridlines for all ticks, but only the top/bottom get labels — the middle label
            sits where the rotated y-title crosses, so labeling it would overlap. */}
        {Array.from({ length: Y_TICKS }).map((_, i) => {
          const frac = i / (Y_TICKS - 1);
          const y = yPos(yMax * frac);
          const labeled = i === 0 || i === Y_TICKS - 1;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length tick array, index is stable
            <g key={`y-${i}`} className="line-chart-y-tick">
              <line className="line-chart-grid" x1={left} y1={y} x2={left + plotW} y2={y} />
              {labeled ? (
                <text
                  className="line-chart-y-tick-label"
                  x={left - 6}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {formatTick(yMax * frac)}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* X-axis start / end labels (swap ends when the axis is reversed). */}
        <text
          className="line-chart-x-tick-label"
          x={left}
          y={top + plotH + 4}
          textAnchor="start"
          dominantBaseline="hanging"
        >
          {formatTick(xReversed ? xMax : xMin)}
        </text>
        <text
          className="line-chart-x-tick-label"
          x={left + plotW}
          y={top + plotH + 4}
          textAnchor="end"
          dominantBaseline="hanging"
        >
          {formatTick(xReversed ? xMin : xMax)}
        </text>

        {/* Series line. */}
        <polyline className="line-chart-series" points={points} fill="none" />

        {/* Point markers at each datum. */}
        {data.map((d, i) => (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: positional series, index is stable
            key={`pt-${i}`}
            className="line-chart-point"
            cx={xPos(Number(d[xKey]))}
            cy={yPos(Number(d[yKey]))}
            r={POINT_RADIUS}
          />
        ))}

        {/* Emphasized marker for the highlighted datum (e.g. a selected table row). */}
        {highlightX != null && highlightY != null ? (
          <circle
            className="line-chart-point-highlight"
            cx={xPos(highlightX)}
            cy={yPos(highlightY)}
            r={POINT_RADIUS + 3}
          />
        ) : null}

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
