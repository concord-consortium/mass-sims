import { EMPTY_STATE_LABEL, PIE_LABEL_PREFIX } from "./constants";

const PIE_WIDTH = 160;
const PIE_HEIGHT = 90;
const CIRCLE_CX = 80;
const CIRCLE_CY = 49;
const CIRCLE_R = 40;

const TWO_PI = Math.PI * 2;
const START_ANGLE = -Math.PI / 2; // 12 o'clock
const LABEL_MIN_FRACTION = 0.08; // slices ≤ 8% are slivers — no label (demo's `s.pct > 0.08`)

export interface PhenotypesPieProps {
  totals?: { healthy: number; infected: number } | null;
  selectedCrossLabel?: string;
}

/** Point on the circle at `angle` (radians, screen coords with y pointing down). */
function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

/**
 * SVG path for a pie slice from `startAngle` to `endAngle` (clockwise). A full circle (the 100%
 * case) can't be drawn with a single arc, so it's two half-arcs; partial slices are a wedge from
 * the center.
 */
function slicePath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = endAngle - startAngle;
  if (sweep >= TWO_PI - 1e-9) {
    const [sx, sy] = polar(cx, cy, r, startAngle);
    const [mx, my] = polar(cx, cy, r, startAngle + Math.PI);
    return `M ${sx} ${sy} A ${r} ${r} 0 1 1 ${mx} ${my} A ${r} ${r} 0 1 1 ${sx} ${sy} Z`;
  }
  const [sx, sy] = polar(cx, cy, r, startAngle);
  const [ex, ey] = polar(cx, cy, r, endAngle);
  const largeArc = sweep > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey} Z`;
}

/** Label anchor for a slice, by fraction. */
function labelPos(fraction: number, mid: number): [number, number] {
  if (fraction >= 1) return [CIRCLE_CX, CIRCLE_CY]; // single slice → center
  const d = fraction > 0.25 ? CIRCLE_R * 0.55 : CIRCLE_R * (2 / 3); // tiny slices push outward
  return polar(CIRCLE_CX, CIRCLE_CY, d, mid);
}

export function PhenotypesPie({
  totals = null,
  selectedCrossLabel = "all crosses",
}: PhenotypesPieProps) {
  const total = totals ? totals.healthy + totals.infected : 0;

  if (!totals || total === 0) {
    return (
      <svg
        aria-label={`${PIE_LABEL_PREFIX}: no data`}
        className="phenotypes-pie"
        height={PIE_HEIGHT}
        role="img"
        viewBox={`0 0 ${PIE_WIDTH} ${PIE_HEIGHT}`}
        width={PIE_WIDTH}
      >
        <circle className="phenotypes-pie__circle" cx={CIRCLE_CX} cy={CIRCLE_CY} r={CIRCLE_R} />
        <text
          className="phenotypes-pie__label"
          dy="0.35em"
          textAnchor="middle"
          x={CIRCLE_CX}
          y={CIRCLE_CY}
        >
          {EMPTY_STATE_LABEL}
        </text>
      </svg>
    );
  }

  const healthyPct = Math.round((totals.healthy / total) * 100);
  const infectedPct = 100 - healthyPct;

  // Infected slice first (clockwise from 12 o'clock), then Healthy.
  const slices = [
    { key: "infected", count: totals.infected, label: `${infectedPct}%` },
    { key: "healthy", count: totals.healthy, label: `${healthyPct}%` },
  ].filter((s) => s.count > 0);

  let angle = START_ANGLE;
  const rendered = slices.map((s) => {
    const fraction = s.count / total;
    const sweep = fraction * TWO_PI;
    const mid = angle + sweep / 2;
    const d = slicePath(CIRCLE_CX, CIRCLE_CY, CIRCLE_R, angle, angle + sweep);
    const [lx, ly] = labelPos(fraction, mid);
    angle += sweep;
    return { ...s, d, lx, ly, showLabel: fraction > LABEL_MIN_FRACTION };
  });

  const ariaLabel = `${PIE_LABEL_PREFIX} for ${selectedCrossLabel}: ${healthyPct}% healthy, ${infectedPct}% infected`;

  return (
    <svg
      aria-label={ariaLabel}
      className="phenotypes-pie"
      height={PIE_HEIGHT}
      role="img"
      viewBox={`0 0 ${PIE_WIDTH} ${PIE_HEIGHT}`}
      width={PIE_WIDTH}
    >
      {rendered.map((s) => (
        <path
          key={s.key}
          className={`phenotypes-pie__slice phenotypes-pie__slice--${s.key}`}
          d={s.d}
        />
      ))}
      {rendered.map((s) =>
        s.showLabel ? (
          <text
            key={`${s.key}-label`}
            className={`phenotypes-pie__slice-label phenotypes-pie__slice-label--${s.key}`}
            dy="0.35em"
            textAnchor="middle"
            x={s.lx}
            y={s.ly}
          >
            {s.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}
