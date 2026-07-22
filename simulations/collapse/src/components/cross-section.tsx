import { domeVisible, isCollapsed, LOCATIONS, roofErosionPct } from "../model/collapse";
import type { SimInput } from "../model/types";
import "./cross-section.scss";

export interface CrossSectionProps {
  input: SimInput;
  year: number;
}

// viewBox geometry. y increases downward: sky on top, ground below SURFACE_Y.
const W = 620;
const H = 360;
const SURFACE_Y = 150;
const CAVE_FLOOR_Y = 345;
const CAVE_CX = 360;
const CAVE_HALF_W = 150;
const ROOF_TOP_THICK = 300; // cave ceiling y when roof is intact (thick roof)
const ROOF_TOP_THIN = 172; // cave ceiling y when fully eroded (just under the surface)
const WATER_TABLE_Y = SURFACE_Y + 40; // shallow water table (Louisville floodplain saturates the ground)

/**
 * Schematic cross-section of the landscape: hills above ground, a cave below whose roof thins
 * and fractures as karsting progresses. Deliberately crude — a placeholder for a designed
 * illustration. All positions derive from the model so the picture tracks the settings + year.
 */
export function CrossSection({ input, year }: CrossSectionProps) {
  const roofPct = roofErosionPct(input, year);
  const collapsed = isCollapsed(input, year);
  const showDome = domeVisible(year);
  const isLimestone = input.soil === "limestone";
  // Only karst locations (Bowling Green) have a shallow cave; Louisville is solid ground.
  const isKarst = LOCATIONS[input.location].karst;

  // Cave ceiling rises toward the surface as the roof erodes.
  const caveTopY = ROOF_TOP_THICK - (roofPct / 100) * (ROOF_TOP_THICK - ROOF_TOP_THIN);

  // Ground (rock) surface polyline with two static hills.
  const hillPeakY = SURFACE_Y - 60;
  const surfacePath = `M0,${SURFACE_Y}
    L60,${SURFACE_Y} Q150,${hillPeakY} 240,${SURFACE_Y}
    L360,${SURFACE_Y} Q450,${SURFACE_Y - 35} 540,${SURFACE_Y}
    L${W},${SURFACE_Y} L${W},${H} L0,${H} Z`;

  // Cave interior (open void). A rounded "lens".
  const caveLeft = CAVE_CX - CAVE_HALF_W;
  const caveRight = CAVE_CX + CAVE_HALF_W;
  const cavePath = `M${caveLeft},${CAVE_FLOOR_Y}
    Q${CAVE_CX},${caveTopY - 18} ${caveRight},${CAVE_FLOOR_Y} Z`;

  // Fracture lines in the roof — more and longer as roofPct grows.
  const fractureCount = Math.round((roofPct / 100) * 6);
  const fractures = Array.from({ length: fractureCount }, (_, i) => {
    const x = caveLeft + 30 + (i * (2 * CAVE_HALF_W - 60)) / Math.max(1, fractureCount - 1);
    const len = 12 + (roofPct / 100) * 40;
    return { x, y1: caveTopY, y2: caveTopY - len };
  });

  const rockFill = isLimestone ? "#d8c39a" : "#9aa0a6"; // limestone tan vs. gray granite
  const domeX = CAVE_CX;

  return (
    <svg
      className="cross-section"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${LOCATIONS[input.location].name} cross-section in year ${Math.round(year)}. ${
        isKarst ? `Cave roof ${Math.round(roofPct)} percent eroded.` : "Solid ground, no cave."
      }${showDome ? " Museum dome and car present." : ""}${
        collapsed ? " The roof has collapsed and the car has fallen into the cave." : ""
      }`}
    >
      {/* Sky */}
      <rect x={0} y={0} width={W} height={SURFACE_Y} fill="#cfe8f5" />

      {/* Ground / rock */}
      <path d={surfacePath} fill={rockFill} stroke="#7a6a45" strokeWidth={2} />
      {/* a faint soil label */}
      <text x={12} y={H - 12} className="layer-label">
        {isLimestone ? "Limestone" : "Granite"}
      </text>

      {/* Cave + roof + fractures — only at karst locations (Bowling Green). Louisville is solid ground. */}
      {isKarst && (
        <>
          {/* Cave void */}
          <path d={cavePath} fill="#5b4a2f" />
          {/* Roof underline to read the ceiling clearly */}
          <path
            d={`M${caveLeft},${CAVE_FLOOR_Y} Q${CAVE_CX},${caveTopY - 18} ${caveRight},${CAVE_FLOOR_Y}`}
            fill="none"
            stroke="#3d3118"
            strokeWidth={2}
          />

          {/* Fractures */}
          {fractures.map((f) => (
            <line
              key={f.x}
              x1={f.x}
              y1={f.y1}
              x2={f.x + 4}
              y2={f.y2}
              stroke="#3d3118"
              strokeWidth={1.5}
              opacity={0.7}
            />
          ))}
        </>
      )}

      {/* Groundwater, visible in both landscapes. */}
      {isKarst ? (
        // Bowling Green: an underground river flowing along the cave floor.
        <path
          className="groundwater-river"
          d={`M${caveLeft + 12},${CAVE_FLOOR_Y - 6}
              Q${CAVE_CX},${CAVE_FLOOR_Y - 14} ${caveRight - 12},${CAVE_FLOOR_Y - 6}
              L${caveRight - 12},${CAVE_FLOOR_Y} L${caveLeft + 12},${CAVE_FLOOR_Y} Z`}
          fill="#3a86c8"
          opacity={0.9}
        />
      ) : (
        // Louisville: groundwater saturates the soil and rock below a shallow water table.
        <g className="groundwater-saturated">
          <rect
            x={0}
            y={WATER_TABLE_Y}
            width={W}
            height={H - WATER_TABLE_Y}
            fill="#3a86c8"
            opacity={0.28}
          />
          <line
            x1={0}
            y1={WATER_TABLE_Y}
            x2={W}
            y2={WATER_TABLE_Y}
            stroke="#2f7fb5"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <text x={12} y={WATER_TABLE_Y - 5} className="layer-label">
            Water table
          </text>
        </g>
      )}

      {/* Dome + car (from 1992). On collapse, the surface opens and the car drops into the cave. */}
      {showDome && !collapsed && (
        <g>
          <DomeAndCar x={domeX} surfaceY={SURFACE_Y} />
        </g>
      )}
      {showDome && collapsed && (
        <g>
          {/* hole in the surface */}
          <path
            d={`M${domeX - 46},${SURFACE_Y} L${domeX - 30},${caveTopY} L${domeX + 30},${caveTopY} L${
              domeX + 46
            },${SURFACE_Y} Z`}
            fill="#5b4a2f"
          />
          {/* broken dome rim */}
          <path
            d={`M${domeX - 46},${SURFACE_Y} a46,30 0 0 1 92,0`}
            fill="none"
            stroke="#b23b3b"
            strokeWidth={3}
            strokeDasharray="6 6"
          />
          {/* dropped car at the cave floor */}
          <Car x={domeX} y={CAVE_FLOOR_Y - 14} />
        </g>
      )}
    </svg>
  );
}

function DomeAndCar({ x, surfaceY }: { x: number; surfaceY: number }) {
  return (
    <g>
      {/* car on the surface */}
      <Car x={x} y={surfaceY - 10} />
      {/* red Skydome over it */}
      <path
        d={`M${x - 46},${surfaceY - 18} a46,34 0 0 1 92,0 Z`}
        fill="#d24b4b"
        stroke="#9e3535"
        strokeWidth={2}
        opacity={0.85}
      />
      <circle cx={x} cy={surfaceY - 50} r={3} fill="#9e3535" />
    </g>
  );
}

function Car({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 16} y={y - 6} width={32} height={9} rx={2} fill="#f0c419" />
      <rect x={x - 9} y={y - 12} width={18} height={8} rx={2} fill="#f0c419" />
      <circle cx={x - 9} cy={y + 4} r={3.2} fill="#333" />
      <circle cx={x + 9} cy={y + 4} r={3.2} fill="#333" />
    </g>
  );
}
