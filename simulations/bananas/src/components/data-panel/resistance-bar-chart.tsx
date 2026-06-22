import { useEffect, useRef, useState } from "react";
import FungusAddedIcon from "../../assets/icons/fungus-added.svg?react";
import { EMPTY_STATE_LABEL } from "./constants";

const BAR_HEIGHT = 158;
const MARGIN_TOP_DEFAULT = 15;
const MARGIN_TOP_FUNGUS = 35;
const MARGIN = { right: 8, bottom: 28, left: 44 };
const Y_TICK_PERCENTS = [0, 25, 50, 75, 100];
const GROUP_GAP = 4;
const BAR_GAP = 2;
const MIN_BAR_H = 2; // a 0% bar still shows a 2px sliver at the baseline
const X_LABEL_OFFSET = 9;

// Fungus-flag geometry
const FLAG_TOP = 4; // demo's flagY = 32 − flagH
const FLAG_H = 28;
const FLAG_PAD_L = 4;
const FLAG_PAD_R = 8;
const FLAG_ICON = 20;
const FLAG_ICON_GAP = 3;
const FLAG_TEXT_W = 46;
const FLAG_W = FLAG_PAD_L + FLAG_ICON + FLAG_ICON_GAP + FLAG_TEXT_W + FLAG_PAD_R;
const FLAG_X = MARGIN.left + 1; // 1px right of the dashed line so the flag's left edge sits on it
const FLAG_R = FLAG_H / 2;
const FLAG_BG_PATH = [
  `M ${FLAG_X} ${FLAG_TOP}`,
  `L ${FLAG_X + FLAG_W - FLAG_R} ${FLAG_TOP}`,
  `A ${FLAG_R} ${FLAG_R} 0 0 1 ${FLAG_X + FLAG_W} ${FLAG_TOP + FLAG_R}`,
  `L ${FLAG_X + FLAG_W} ${FLAG_TOP + FLAG_H - FLAG_R}`,
  `A ${FLAG_R} ${FLAG_R} 0 0 1 ${FLAG_X + FLAG_W - FLAG_R} ${FLAG_TOP + FLAG_H}`,
  `L ${FLAG_X} ${FLAG_TOP + FLAG_H}`,
  "Z",
].join(" ");

export interface ResistanceBarChartProps {
  series?: { healthy: number[]; infected: number[] } | null;
  fungusOn?: boolean;
  selectedCross?: number | null;
}

export function ResistanceBarChart({
  series = null,
  fungusOn = false,
  selectedCross = null,
}: ResistanceBarChartProps) {
  // Width tracked via ResizeObserver on the wrapping div (the LineChart-aligned pattern): the
  // Data column flexes and the chart fills it. The SVG renders only once width > 0, which avoids
  // the one-frame distorted-viewBox flicker on mount (a 1px coordinate system stretched to fit).
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

  const marginTop = fungusOn ? MARGIN_TOP_FUNGUS : MARGIN_TOP_DEFAULT;
  const plotH = BAR_HEIGHT - marginTop - MARGIN.bottom;
  const plotRight = Math.max(MARGIN.left, width - MARGIN.right);
  const plotWidth = plotRight - MARGIN.left;
  const plotCenterX = (MARGIN.left + plotRight) / 2;
  const plotCenterY = marginTop + plotH / 2;
  const baseY = marginTop + plotH;

  const hasData = series !== null && series.healthy.length > 0;
  const numCrosses = hasData ? series.healthy.length : 0;
  const groupW = hasData ? plotWidth / numCrosses : 0;
  // Clamp at 0: at very narrow widths groupW shrinks below the fixed gaps, which would otherwise
  // make barW negative and emit invalid `<rect width="-N">`.
  const barW = hasData ? Math.max(0, (groupW - GROUP_GAP - BAR_GAP) / 2) : 0;
  const showHighlight =
    hasData && selectedCross !== null && selectedCross >= 0 && selectedCross < numCrosses;

  let ariaLabel = "Fungus resistance over crosses: no data";
  if (hasData) {
    const lastHealthy = series.healthy[numCrosses - 1];
    const lastInfected = series.infected[numCrosses - 1];
    ariaLabel = `Bar chart showing fungus resistance over ${numCrosses} cross${
      numCrosses > 1 ? "es" : ""
    }. Latest: ${lastHealthy}% healthy, ${lastInfected}% infected`;
  }

  return (
    <div className="resistance-chart-wrap" ref={containerRef}>
      {width > 0 ? (
        <svg
          aria-label={ariaLabel}
          className="resistance-bar-chart"
          height={BAR_HEIGHT}
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${width} ${BAR_HEIGHT}`}
          width="100%"
        >
          {/* Highlight behind the selected group — first child so everything paints on top. */}
          {showHighlight ? (
            <rect
              className="bar-chart-highlight"
              x={MARGIN.left + selectedCross * groupW}
              y={marginTop}
              width={groupW}
              height={plotH + 27}
            />
          ) : null}
          {Y_TICK_PERCENTS.map((pct) => {
            const y = marginTop + plotH - (pct / 100) * plotH;
            return (
              <g key={pct}>
                {/* The 0% gridline doubles as the x-axis baseline. */}
                <line
                  className="bar-chart-gridline"
                  x1={MARGIN.left}
                  y1={y}
                  x2={plotRight}
                  y2={y}
                />
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

          {fungusOn ? (
            <g className="fungus-flag">
              <line
                className="fungus-flag-line"
                x1={MARGIN.left}
                y1={FLAG_TOP}
                x2={MARGIN.left}
                y2={baseY}
              />
              <path className="fungus-flag-bg" d={FLAG_BG_PATH} />
              <FungusAddedIcon
                className="fungus-flag-icon"
                aria-hidden="true"
                x={MARGIN.left + 1 + FLAG_PAD_L}
                y={FLAG_TOP + (FLAG_H - FLAG_ICON) / 2}
                width={FLAG_ICON}
                height={FLAG_ICON}
              />
              <text
                className="fungus-flag-label"
                dominantBaseline="central"
                textAnchor="start"
                x={MARGIN.left + 1 + FLAG_PAD_L + FLAG_ICON + FLAG_ICON_GAP}
                y={FLAG_TOP + FLAG_H / 2 + 1.5}
              >
                Fungus
              </text>
            </g>
          ) : null}

          {hasData ? (
            <>
              {series.healthy.map((_, gi) => {
                const label = `A${gi + 1}`;
                return (
                  <text
                    key={label}
                    className="bar-chart-x-label"
                    dominantBaseline="hanging"
                    textAnchor="middle"
                    x={MARGIN.left + gi * groupW + groupW / 2}
                    y={baseY + X_LABEL_OFFSET}
                  >
                    {label}
                  </text>
                );
              })}
              {series.healthy.map((healthyPct, gi) => {
                const infectedPct = series.infected[gi];
                const groupX = MARGIN.left + gi * groupW + GROUP_GAP / 2;
                const healthyH = Math.max(MIN_BAR_H, (healthyPct / 100) * plotH);
                const infectedH = Math.max(MIN_BAR_H, (infectedPct / 100) * plotH);
                const infectedX = groupX + barW + BAR_GAP;
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: crosses are append-only, index is stable
                  <g key={`A${gi + 1}-bars`}>
                    <rect
                      className="bar-chart-bar--healthy"
                      x={groupX}
                      y={baseY - healthyH}
                      width={barW}
                      height={healthyH}
                    />
                    <rect
                      className="bar-chart-bar--infected"
                      x={infectedX}
                      y={baseY - infectedH}
                      width={barW}
                      height={infectedH}
                    />
                  </g>
                );
              })}
            </>
          ) : fungusOn ? null : (
            // Empty state shows "No data" — unless fungus is on, where the flag stands in for it
            // (matches the demo's empty + fungus-on rendering).
            <text
              className="bar-chart-empty-label"
              dy="0.35em"
              textAnchor="middle"
              x={plotCenterX}
              y={plotCenterY}
            >
              {EMPTY_STATE_LABEL}
            </text>
          )}
        </svg>
      ) : null}

      {hasData ? (
        <table className="sr-only">
          <thead>
            <tr>
              <th>Cross</th>
              <th>Healthy</th>
              <th>Infected</th>
            </tr>
          </thead>
          <tbody>
            {series.healthy.map((healthyPct, gi) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: crosses are append-only, index is stable
              <tr key={`A${gi + 1}-row`}>
                {/* Fungus is all-or-nothing, so it's "introduced" at the first cross when on. */}
                <td>{`A${gi + 1}${fungusOn && gi === 0 ? " (fungus introduced)" : ""}`}</td>
                <td>{`${healthyPct}%`}</td>
                <td>{`${series.infected[gi]}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
