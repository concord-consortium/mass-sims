import type { RecordedTrial } from "./types";

/**
 * The shape persisted to / restored from Activity Player's `interactiveState`. Plain
 * JSON-serializable values only — `trials` is `RecordedTrial[]` whose `input`, `output`,
 * and `finalTransient` (when present) are also plain objects. Per-frame transient state
 * (the live walker positions, frame counter, and `liveSeries` from the in-progress run)
 * is intentionally NOT persisted; students restart trials from the beginning when they
 * return to the activity.
 */
export interface SavedState {
  trials: RecordedTrial[];
  selectedId: string;
}
