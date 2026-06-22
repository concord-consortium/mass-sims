import { EMPTY_STATE_LABEL } from "./constants";

const PIE_WIDTH = 160;
const PIE_HEIGHT = 90;
const CIRCLE_CX = 80;
const CIRCLE_CY = 49;
const CIRCLE_R = 40;

export interface PhenotypesPieProps {
  /**
   * Offspring counts. `null` renders the "No data" empty state. MAS-11 always passes `null`;
   * MAS-12 will pass real counts and draw slices.
   */
  totals?: { healthy: number; infected: number } | null;
}

export function PhenotypesPie({ totals = null }: PhenotypesPieProps) {
  // TODO MAS-12: when `totals` is non-null, render real pie slices + percentages. MAS-11 renders
  // the empty state unconditionally.
  void totals;

  return (
    <svg
      aria-label="Offspring phenotypes: no data"
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
