/**
 * Trial identity constants. Trials are keyed by a letter A–J; the cap of 10 is derived from the
 * letter list so "up to 10" and "A–J" stay a single source of truth.
 */
export const TRIAL_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;

export const MAX_TRIALS = TRIAL_LETTERS.length; // 10

export type TrialLetter = (typeof TRIAL_LETTERS)[number];
