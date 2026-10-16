import type { SettingId, TestId } from "./tests";

/**
 * How long a test is meant to take *in the simulation*, in seconds.
 *
 * The three bench tests all run for two minutes, which is long enough for a lump to dissolve or
 * melt and short enough that a student would plausibly stand and watch. The lamp runs for
 * exactly the exposure that was dialled in, which is the whole point of its dial.
 *
 * This is the one place a duration is written down. The meter counts it out and the caption
 * quotes it, so they cannot disagree.
 */
export function simDurationSeconds(test: TestId, setting: SettingId | null): number {
  if (test === "lamp") return EXPOSURE_SECONDS[String(setting)] ?? EXPOSURE_SECONDS.seconds;
  return TWO_MINUTES;
}

const TWO_MINUTES = 120;

const EXPOSURE_SECONDS: Record<string, number> = {
  seconds: 10,
  hour: 60 * 60,
  day: 24 * 60 * 60,
  fortnight: 14 * 24 * 60 * 60,
};

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
