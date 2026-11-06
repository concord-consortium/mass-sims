import { BATH_STEPS } from "./observe";
import type { TestId } from "./tests";

/**
 * How long a test is meant to take *in the simulation*, in seconds.
 *
 * Water and vinegar run for two minutes, which is long enough for a lump to dissolve and short
 * enough that a student would plausibly stand and watch. The bath spends two minutes at each of
 * its temperatures. The lamp always runs for two weeks, long enough for UV to break down what it
 * can.
 *
 * This is the one place a duration is written down. The meter counts it out and the caption
 * quotes it, so they cannot disagree.
 */
export function simDurationSeconds(test: TestId): number {
  if (test === "lamp") return TWO_WEEKS;
  if (test === "bath") return TWO_MINUTES * BATH_STEPS.length;
  return TWO_MINUTES;
}

const TWO_MINUTES = 120;

const TWO_WEEKS = 14 * 24 * 60 * 60;

/**
 * A duration in the unit a person would actually say it in — "45 s", "2 min", "6 h", "14 d".
 * Rounds rather than truncates so a meter at 99% reads as the full span rather than one short.
 */
export function formatSimTime(seconds: number): string {
  if (seconds < 90) return `${Math.round(seconds)} s`;
  if (seconds < 60 * 60) return `${Math.round(seconds / 60)} min`;
  if (seconds < 48 * 60 * 60) return `${Math.round(seconds / 3600)} h`;
  return `${Math.round(seconds / 86400)} d`;
}
