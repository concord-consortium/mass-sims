import type { SimInput, SimOutput, SimTransient } from "./types";

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

// Peak erosion at 2014 (mock magnitudes). Roof: limestone karsts; dry is 1/10 of wet; bedrock
// never karsts. Hillside: wind drives surface erosion; calm is near zero. Wind never affects
// the roof; wetness/soil never affect the hillside.
const ROOF_PEAK_WET = 100;
const ROOF_PEAK_DRY = 10;
const HILL_PEAK_WINDY = 35;
const HILL_PEAK_CALM = 2;

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
  if (input.soil !== "limestone") return 0; // bedrock never karsts, however wet
  const peak = input.wetness === "wet" ? ROOF_PEAK_WET : ROOF_PEAK_DRY;
  return clampPct(timeProgress(year) * peak);
}

/** Hillside (surface) erosion at a given year, 0–100. Driven only by wind. */
export function hillsideErosionPct(input: SimInput, year: number): number {
  const peak = input.wind === "windy" ? HILL_PEAK_WINDY : HILL_PEAK_CALM;
  return clampPct(timeProgress(year) * peak);
}

/** The dome + car are present from 1992 onward. */
export function domeVisible(year: number): boolean {
  return year >= DOME_YEAR;
}

/** The roof fails (and the car drops) only when wet + limestone, at/after 2014. */
export function isCollapsed(input: SimInput, year: number): boolean {
  return year >= COLLAPSE_YEAR && input.soil === "limestone" && input.wetness === "wet";
}

export function initialTransient(): SimTransient {
  return { year: START_YEAR };
}

/** The recorded outcome of a trial, evaluated at the final year. */
export function finalizeTrial(input: SimInput): SimOutput {
  return {
    collapsed: isCollapsed(input, END_YEAR),
    roofErosionPct: roofErosionPct(input, END_YEAR),
    hillsideErosionPct: hillsideErosionPct(input, END_YEAR),
  };
}
