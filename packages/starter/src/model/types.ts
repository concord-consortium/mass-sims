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

/** A trial that has finished recording. */
export interface RecordedTrial {
  /** Stable id (random; not the letter). */
  id: string;
  /** The inputs used for this trial — snapshotted at the moment the trial started. */
  input: SimInput;
  /** The outputs the trial produced. */
  output: SimOutput;
}
