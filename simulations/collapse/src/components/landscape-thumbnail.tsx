import { type ComboId, comboById, type SampleRow } from "../model/sim";
import "./landscape-thumbnail.scss";

interface LandscapeThumbnailProps {
  combo: ComboId;
  row: SampleRow;
  className?: string;
}

// Rough upper bound on eroded depth (limestone-wet, full span) so the cave normalizes to ~[0,1].
const EROSION_FULL_MM = 6000;

/**
 * A tiny schematic cross-section of the underground for one sampled row. Limestone grows a
 * cave/void as rock erodes (wet fastest → karst); granite shows fractured groundwater storage but
 * no cave. Reads the row's numbers; purely illustrative.
 */
export function LandscapeThumbnail({ combo, row, className }: LandscapeThumbnailProps) {
  const { terrain } = comboById(combo);
  const erosion = Math.min(1, row.erodedDepth / EROSION_FULL_MM);
  const waterPct = row.pctWater;

  const W = 100;
  const H = 64;
  const surfaceY = 20;
  const soilBottom = 32;
  const rockTop = soilBottom;
  const waterTableY = soilBottom + (H - soilBottom) * (1 - Math.min(1, waterPct / 40)) * 0.5;

  const rockFill = terrain === "granite" ? "#d9c4c9" : "#e7e3da";
  const caveCx = W * 0.52;
  const caveCy = rockTop + (H - rockTop) * 0.55;
  const caveRx = 4 + erosion * 34;
  const caveRy = 2.5 + erosion * 13;
  const surfaceSag = terrain !== "granite" ? erosion * 5 : 0;

  return (
    <svg
      className={`landscape-thumbnail ${className ?? ""}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${comboById(combo).name}: ${Math.round(row.erodedDepth)} mm eroded`}
    >
      <rect x={0} y={0} width={W} height={surfaceY} className="sky" />
      <rect x={0} y={rockTop} width={W} height={H - rockTop} fill={rockFill} />
      <path
        d={`M0 ${surfaceY} Q ${W / 2} ${surfaceY + surfaceSag} ${W} ${surfaceY} L ${W} ${soilBottom} L 0 ${soilBottom} Z`}
        className="soil"
      />
      <rect x={0} y={waterTableY} width={W} height={H - waterTableY} className="groundwater" />

      {terrain === "granite" ? (
        <g className="fractures">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static array, index is stable
            <line key={i} x1={12 + i * 20} y1={rockTop + 4} x2={18 + i * 20} y2={H - 4} />
          ))}
        </g>
      ) : (
        <ellipse cx={caveCx} cy={caveCy} rx={caveRx} ry={caveRy} className="cave" />
      )}

      <path
        d={`M0 ${surfaceY} Q ${W / 2} ${surfaceY + surfaceSag} ${W} ${surfaceY}`}
        className="surface-line"
        fill="none"
      />
    </svg>
  );
}
