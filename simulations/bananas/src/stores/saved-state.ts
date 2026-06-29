import {
  TRIAL_LETTERS_DEFAULT,
  type TrialLetter,
  toVersionedSavedState,
} from "@concord-consortium/mass-sims-shared";
import type { RootStoreSnapshotOut } from "./root-store";
import { TrialModel, type TrialState } from "./trial-model";

export const SAVED_STATE_VERSION = 1;

const VALID_LETTERS = new Set<string>(TRIAL_LETTERS_DEFAULT);

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

/**
 * Project the persisted slice out of a full root-store snapshot (drops transient UI state). The cast
 * narrows the snapshot's `types.string` p1/p2 back to their semantic `ParentId` at the wire boundary.
 */
export function toSavedState(snap: RootStoreSnapshotOut): SavedState {
  return toVersionedSavedState(SAVED_STATE_VERSION, snap) as SavedState;
}

/**
 * Validate a restored `interactiveState` into a `SavedState`, or `null` when it's unrecognized or
 * malformed — the caller then keeps its fresh seeded store instead of crashing inside `applySnapshot`.
 * The `version` field is the forward-migration hook; today only version 1 exists.
 */
export function migrateSavedState(raw: unknown): SavedState | null {
  if (!raw || typeof raw !== "object") return null;
  const { version, trials, selectedTrialLetter } = raw as Record<string, unknown>;
  if (version !== SAVED_STATE_VERSION) return null;
  // The selected letter must be A–J, else the UiStore enumeration throws on hydrate. A valid-but-
  // absent letter is fine — App's normalization reaction re-selects the first trial.
  if (typeof selectedTrialLetter !== "string" || !VALID_LETTERS.has(selectedTrialLetter)) {
    return null;
  }
  if (!trials || typeof trials !== "object" || Array.isArray(trials)) return null;
  const entries = Object.entries(trials);
  if (entries.length === 0) return null;
  // Every key must be a valid A–J letter and every value a hydratable TrialModel snapshot, else
  // applySnapshot would throw mid-hydrate. `TrialModel.is` is reliable here because the required
  // fields are strict booleans (not `types.frozen`). Reject so the caller keeps the seeded store.
  for (const [letter, trial] of entries) {
    if (!VALID_LETTERS.has(letter) || !TrialModel.is(trial)) return null;
  }
  return {
    version: SAVED_STATE_VERSION,
    trials: trials as SavedState["trials"],
    selectedTrialLetter: selectedTrialLetter as TrialLetter,
  };
}
