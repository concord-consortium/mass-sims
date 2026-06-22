import { useEffect, useRef, useState } from "react";
import { EMPTY_STATE_LABEL } from "./constants";

const BAR_HEIGHT = 158;
const MARGIN = { top: 15, right: 8, bottom: 28, left: 44 };
const PLOT_H = BAR_HEIGHT - MARGIN.top - MARGIN.bottom;
const Y_TICK_PERCENTS = [0, 25, 50, 75, 100];

export interface ResistanceBarChartProps {
  /**
   * Per-cross healthy/infected percentages. `null` renders the empty frame. MAS-11 always passes
   * `null`; MAS-12 will pass real series and draw the column bars.
   */
  series?: { healthy: number[]; infected: number[] } | null;
}

export function ResistanceBarChart({ series = null }: ResistanceBarChartProps) {
  // TODO MAS-12: when `series` is non-null, draw the column bars + x-axis cross labels. MAS-11
  // renders the empty frame (gridlines, y-axis labels, "No data") unconditionally.
  void series;

  // The chart fills the flexing Data column, so the gridlines' right edge and the centered "No
  // data" depend on the laid-out width. Track it with a ResizeObserver and drive a 1:1 viewBox whose
  // width matches the rendered width so labels stay crisp (same viewBox pattern as the shared
  // LineChart)
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.round(entries[0].contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const plotRight = Math.max(MARGIN.left, width - MARGIN.right);
  const plotCenterX = (MARGIN.left + plotRight) / 2;
  const plotCenterY = MARGIN.top + PLOT_H / 2;

  return (
    <svg
      aria-label="Fungus resistance over crosses: no data"
      className="resistance-bar-chart"
      height={BAR_HEIGHT}
      preserveAspectRatio="none"
      ref={svgRef}
      role="img"
      viewBox={`0 0 ${width || 1} ${BAR_HEIGHT}`}
      width="100%"
    >
      {Y_TICK_PERCENTS.map((pct) => {
        const y = MARGIN.top + PLOT_H - (pct / 100) * PLOT_H;
        return (
          <g key={pct}>
            {/* The 0% gridline doubles as the x-axis baseline. */}
            <line className="bar-chart-gridline" x1={MARGIN.left} y1={y} x2={plotRight} y2={y} />
            <text
              className="bar-chart-axis-label"
              dominantBaseline="central"
              textAnchor="end"
              x={MARGIN.left - 6}
              y={y}
            >
              {pct}%
            </text>
          </g>
        );
      })}
      <text
        className="bar-chart-empty-label"
        dy="0.35em"
        textAnchor="middle"
        x={plotCenterX}
        y={plotCenterY}
      >
        {EMPTY_STATE_LABEL}
      </text>
    </svg>
  );
}
