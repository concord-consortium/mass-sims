/** Walker — a single dot in the random-walk simulation. */
export interface Walker {
  x: number;
  y: number;
}

/** Inputs the user controls between trials. */
export interface SimInput {
  /** Number of walkers (1–500). */
  walkerCount: number;
  /** Per-frame step size in pixels (0.1–5). */
  stepSize: number;
  /** Total frames per trial (50–500). */
  framesPerTrial: number;
  /** Seed for the seeded-random PRNG — same seed → same trial. */
  seed: string;
}

/** Per-trial recorded output. */
export interface SimOutput {
  /** Average distance from origin across all walkers at trial end. */
  avgDistance: number;
  /** Standard deviation of distances across walkers at trial end. */
  stdDevDistance: number;
  /** A sampled time series of avg distance (one sample per 10 frames) for the chart. */
  avgDistanceSeries: number[];
}

/** Per-frame model state. */
export interface SimTransient {
  /** Current frame within the active trial (0 ≤ frame < framesPerTrial). */
  frame: number;
  /** Current positions of all walkers. */
  walkers: Walker[];
  /** Running avg-distance series being accumulated; copied into output at trial end. */
  avgDistanceSeries: number[];
}

/**
 * A trial in the Trials column. Created empty (the active trial the sim runs into); becomes
 * "recorded" once it has been run. Trials are reset (cleared back to empty), never deleted —
 * see docs/ui-design-plan.md §14. A new trial only appears when the user clicks the "New" card.
 */
export interface RecordedTrial {
  /** Stable id (random; not the letter — the letter is derived from list index). */
  id: string;
  /** The inputs this trial runs with, including its own fixed seed (deterministic re-runs). */
  input: SimInput;
  /** The outputs the trial produced, or `null` until it has been run. */
  output: SimOutput | null;
  /** Final-frame snapshot used to restore the canvas when the trial is selected; `null` until run. */
  finalTransient: SimTransient | null;
}
