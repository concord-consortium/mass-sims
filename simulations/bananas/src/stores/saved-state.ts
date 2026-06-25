import type { TrialLetter } from "../model/trials";
import type { RootStoreSnapshotOut } from "./root-store";
import type { TrialState } from "./trial-model";

export const SAVED_STATE_VERSION = 1;

/**
 * The shape persisted to / restored from Activity Player's `interactiveState`: the multi-trial map
 * plus the active trial letter. Transient UI state (`selectedCrossByTrial`) is deliberately left out
 * — cross-selection resets across reloads.
 */
export interface SavedState {
  version: typeof SAVED_STATE_VERSION;
  trials: Partial<Record<TrialLetter, TrialState>>;
  selectedTrialLetter: TrialLetter;
}

/** Project the persisted slice out of a full root-store snapshot (drops transient UI state). */
export function toSavedState(snap: RootStoreSnapshotOut): SavedState {
  return {
    version: SAVED_STATE_VERSION,
    // The model stores p1/p2 as `types.string`; they're semantically `ParentId`, so narrow at the
    // wire boundary.
    trials: snap.trials as SavedState["trials"],
    selectedTrialLetter: snap.ui.selectedTrialLetter,
  };
}
