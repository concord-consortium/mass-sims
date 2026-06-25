// Collapse — a mock simulation of the karst sinkhole that collapsed the National Corvette
// Museum's Skydome in Bowling Green, KY (2014), over part of the Mammoth Cave karst system.
//
// This is intentionally a *mock*: the "model" is a deterministic, scripted function of the
// three settings and the current year, not real geophysics. It exists to exercise the
// SimulationFrame layout and shared controls/charts with representative behavior.

export type Wetness = "wet" | "dry";
export type Wind = "windy" | "calm";
export type Soil = "limestone" | "bedrock";

/** The climate/soil configuration the student chooses for a trial. */
export interface SimInput {
  wetness: Wetness;
  wind: Wind;
  soil: Soil;
}

/** Per-trial recorded outcome, captured when the timeline reaches the final year (2014). */
export interface SimOutput {
  /** Whether the cave roof failed and the car dropped (wet + limestone only). */
  collapsed: boolean;
  /** Cave-roof erosion at 2014, 0–100. */
  roofErosionPct: number;
  /** Hillside erosion at 2014, 0–100. */
  hillsideErosionPct: number;
}

/** Per-frame state: where we are on the 2000-year timeline. */
export interface SimTransient {
  /** Current year, START_YEAR … END_YEAR (see model/collapse.ts). */
  year: number;
}

/**
 * A trial in the Trials column — created empty, becomes "recorded" once it has been run to
 * 2014. Reset clears a trial back to empty; trials are never deleted.
 */
export interface RecordedTrial {
  id: string;
  /** The climate/soil settings this trial runs with. */
  input: SimInput;
  /** The recorded outcome, or `null` until the trial has been run to the final year. */
  output: SimOutput | null;
  /** Final-frame snapshot (the year reached), or `null` until run. */
  finalTransient: SimTransient | null;
}
