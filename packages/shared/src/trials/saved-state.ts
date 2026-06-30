/**
 * Shared saved-state envelope helper. The persisted wire format every sim uses is a FLAT envelope —
 * `{ version, trials, selectedTrialLetter, ...rest }` — with the version alongside the data. This
 * centralizes the projection from an MST root snapshot to that envelope so each sim's
 * `saved-state.ts` only declares its sim-specific `trials` type.
 *
 * Each sim still owns its own `migrateSavedState` (the old-shape → new-shape logic is sim-specific);
 * this helper covers only the forward projection of the current shape.
 */

import type { TrialLetter } from "./constants";

export interface VersionedSavedState<TTrials> {
  version: number;
  trials: TTrials;
  selectedTrialLetter: TrialLetter;
}

/**
 * Project the persisted slice out of a full root-store snapshot: the trials map plus the active
 * trial letter, tagged with `version`. Drops transient UI state (anything on `ui` other than the
 * selected letter — e.g. Bananas's `selectedCrossByTrial`).
 */
export function toVersionedSavedState<TTrials>(
  version: number,
  snap: { trials: TTrials; ui: { selectedTrialLetter: TrialLetter } },
): VersionedSavedState<TTrials> {
  return {
    version,
    trials: snap.trials,
    selectedTrialLetter: snap.ui.selectedTrialLetter,
  };
}
