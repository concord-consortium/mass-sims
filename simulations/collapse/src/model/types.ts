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
