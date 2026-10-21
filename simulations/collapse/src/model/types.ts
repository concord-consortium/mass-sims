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
