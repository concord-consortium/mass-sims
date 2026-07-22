import type { Location, SimInput, SimOutput, SimTransient } from "./types";

// ---- Locations ---------------------------------------------------------------------------
// Bowling Green sits over a shallow soluble-limestone karst (part of the Mammoth Cave system): a cave
// whose roof can dissolve and fail. Louisville sits on the Ohio River floodplain — thick soil over solid
// granite, with no shallow cave — so the roof-collapse mechanism isn't present there, regardless of the
// weather or soil setting. `karst` is what gates roof erosion / collapse below.
export const LOCATIONS = {
  "bowling-green": {
    name: "Bowling Green",
    karst: true,
    blurb:
      "Over the Mammoth Cave karst — a shallow limestone cave whose roof can dissolve and fail.",
  },
  louisville: {
    name: "Louisville",
    karst: false,
    blurb:
      "On the Ohio River floodplain — thick soil over solid granite, with no shallow cave to collapse.",
  },
} as const satisfies Record<Location, { name: string; karst: boolean; blurb: string }>;

// ---- Timeline ----------------------------------------------------------------------------
// A ~2000-year span ending in 2014 (the year of the real collapse). Two scripted events:
// the museum dome + car appear in 1992, and the roof fails in 2014 (wet + limestone only).
export const START_YEAR = 14; // 2014 − 2000
export const END_YEAR = 2014;
export const DOME_YEAR = 1992; // Skydome built; car parked beneath
export const COLLAPSE_YEAR = 2014;

/** Years advanced per animation frame while playing (mock pacing → ~16s for the full span). */
export const YEARS_PER_FRAME = 2;

// ---- Climate presets (shown to the student to set expectations) ---------------------------
export const RAINFALL = {
  wet: { inchesPerYear: 50, rainyDays: 120 },
  dry: { inchesPerYear: 15, rainyDays: 30 },
} as const;

// Peak erosion at 2014 (mock magnitudes). Roof: limestone karsts; dry is 1/10 of wet; granite
// never karsts.
const ROOF_PEAK_WET = 100;
const ROOF_PEAK_DRY = 10;

const clampPct = (n: number) => Math.max(0, Math.min(100, n));
/** 0 at START_YEAR → 1 at END_YEAR. */
export function timeProgress(year: number): number {
  return clamp01((year - START_YEAR) / (END_YEAR - START_YEAR));
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Cave-roof erosion (karsting) at a given year, 0–100. */
export function roofErosionPct(input: SimInput, year: number): number {
  if (!LOCATIONS[input.location].karst) return 0; // no shallow soluble cave at this location
  if (input.soil !== "limestone") return 0; // granite never karsts, however wet
  const peak = input.wetness === "wet" ? ROOF_PEAK_WET : ROOF_PEAK_DRY;
  return clampPct(timeProgress(year) * peak);
}

// ---- Erosion in inches (mock magnitudes, shown in the Data panel) -------------------------
export const ROOF_MAX_INCHES = 240; // depth of cave-roof rock removed at full dissolution

/** Cave-roof erosion at a given year, in inches. */
export function roofErosionInches(input: SimInput, year: number): number {
  return (roofErosionPct(input, year) / 100) * ROOF_MAX_INCHES;
}

// ---- Carbonate dissolved in groundwater (mg/L, mock) --------------------------------------
// Soluble limestone karst dissolves into the groundwater → lots of carbonate; elsewhere it stays at a
// low background level (no soluble rock in the water's path).
export const CARBONATE_MAX = 300;
export function carbonateMgPerL(input: SimInput): number {
  return LOCATIONS[input.location].karst && input.soil === "limestone" ? 250 : 20;
}

/** The dome + car are present from 1992 onward. */
export function domeVisible(year: number): boolean {
  return year >= DOME_YEAR;
}

/**
 * The roof fails (and the car drops) only at a karst location (Bowling Green), when wet + limestone,
 * at/after 2014. Louisville never collapses — there is no shallow cave to fail.
 */
export function isCollapsed(input: SimInput, year: number): boolean {
  return (
    LOCATIONS[input.location].karst &&
    year >= COLLAPSE_YEAR &&
    input.soil === "limestone" &&
    input.wetness === "wet"
  );
}

export function initialTransient(): SimTransient {
  return { year: START_YEAR };
}

/** The recorded outcome of a trial, evaluated at the final year. */
export function finalizeTrial(input: SimInput): SimOutput {
  return {
    collapsed: isCollapsed(input, END_YEAR),
    roofErosionPct: roofErosionPct(input, END_YEAR),
  };
}
