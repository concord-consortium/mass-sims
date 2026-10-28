/** One row of a trial's data table. */
export interface Sample {
  /** A per-trial counter, never shown; see `TrialModel`. */
  id: number;
  /** One of `TIMELINE_VALUES`. */
  years: number;
  /** The reported erosion rate, mm / 1,000 yr (jittered). */
  rate: number;
  /** The rock above the cave, mm (deterministic). */
  roof: number;
}

export type SortKey = "years" | "rate" | "roof";
export type SortDirection = 1 | -1;
export interface SortState {
  key: SortKey | null;
  direction: SortDirection;
}

// The placeholder random-walk types below go when the trial model moves to `Sample` (next step).

export interface Walker {
  x: number;
  y: number;
}

export interface SimInput {
  walkerCount: number;
  stepSize: number;
  framesPerTrial: number;
  /** The same seed gives the same trial. */
  seed: string;
}

export interface SimOutput {
  /** Average distance from the origin at trial end. */
  avgDistance: number;
  /** Standard deviation of those distances. */
  stdDevDistance: number;
  /** Average distance sampled every 10 frames. */
  avgDistanceSeries: number[];
}

export interface SimTransient {
  /** 0 ≤ frame < framesPerTrial. */
  frame: number;
  walkers: Walker[];
  /** Copied into the output at trial end. */
  avgDistanceSeries: number[];
}

/** One trial's data. Mirrors `TrialState` in stores/trial-model.ts. */
export interface RecordedTrial {
  input: SimInput;
  /** `null` until the trial has been run. */
  output: SimOutput | null;
  /** The final frame, or `null` until the trial has been run. */
  finalTransient: SimTransient | null;
}
