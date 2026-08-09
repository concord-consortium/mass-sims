// Shared run-timing constants. Kept in one place so the run controller (`use-storm-run`) and any layer
// that re-derives the run clock (the Data-panel progress bar in `use-progress-bar`) read the SAME numbers —
// a divergence here would let the progress bar and the animation finish at different times.

import type { Outcome } from "../model/weather";

/**
 * Total run duration per outcome, in seconds — the finalize time, when the outcome commits. For the four
 * cloud outcomes it is the 1.5 s arrow-converge pre-delay plus the cloud's own duration; `windy`/`fair`
 * have no cloud and finish on a ~3 s timeout.
 */
export const TOTAL_DUR_S: Record<Outcome, number> = {
  strong: 11.5,
  moderate: 8.5,
  weakCoastal: 6.5,
  humidNoStorm: 9.5,
  windy: 3,
  fair: 3,
};

/** Clamp per-frame dt so a long stall can't overshoot the finalize deadline (or a resume jump it). */
export const MAX_FRAME_MS = 100;
