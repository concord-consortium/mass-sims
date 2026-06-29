import {
  TRIAL_LETTERS_DEFAULT,
  type TrialLetter,
  toVersionedSavedState,
} from "@concord-consortium/mass-sims-shared";
import type { RootStoreSnapshotOut } from "./root-store";
import type { TrialState } from "./trial-model";

export const SAVED_STATE_VERSION = 1;

const VALID_LETTERS = new Set<string>(TRIAL_LETTERS_DEFAULT);

/**
 * Whether a persisted trial value can hydrate into a `TrialModel`. `input` is required (the views
 * read its fields), while `output` / `finalTransient` are nullable. A non-object or input-less value
 * would throw inside `applySnapshot`, so it's rejected upstream.
 */
function isHydratableTrial(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const { input, output, finalTransient } = value as Record<string, unknown>;
  if (!input || typeof input !== "object") return false;
  if (output != null && typeof output !== "object") return false;
  if (finalTransient != null && typeof finalTransient !== "object") return false;
  return true;
}

/**
 * The shape persisted to / restored from Activity Player's `interactiveState`: the multi-trial map
 * (keyed by letter A–J) plus the active trial letter, tagged with a `version` for forward migration.
 * Per-frame transient state is never persisted.
 */
export interface SavedState {
  version: typeof SAVED_STATE_VERSION;
  trials: Partial<Record<TrialLetter, TrialState>>;
  selectedTrialLetter: TrialLetter;
}

/** Project the persisted slice out of a full root-store snapshot, via the shared envelope helper. */
export function toSavedState(snap: RootStoreSnapshotOut): SavedState {
  return toVersionedSavedState(SAVED_STATE_VERSION, snap) as SavedState;
}

/**
 * Validate a restored `interactiveState` into a `SavedState`, or `null` when it's unrecognized or
 * malformed (the caller then keeps its fresh seeded store). The `version` field is the
 * forward-migration hook: today only version 1 exists, so this validates the current shape; future
 * shape changes would branch on `version` here. (This sim has never shipped, so there is no
 * pre-versioned saved state to migrate from.)
 */
export function migrateSavedState(raw: unknown): SavedState | null {
  if (!raw || typeof raw !== "object") return null;
  const { version, trials, selectedTrialLetter } = raw as Record<string, unknown>;
  if (version !== SAVED_STATE_VERSION) return null;
  // The selected letter must be A–J, else the UiStore enumeration throws on hydrate.
  if (typeof selectedTrialLetter !== "string" || !VALID_LETTERS.has(selectedTrialLetter)) {
    return null;
  }
  if (!trials || typeof trials !== "object" || Array.isArray(trials)) return null;
  const entries = Object.entries(trials);
  if (entries.length === 0) return null;
  // The selected letter must name a present trial, every key must be a valid A–J letter, and every
  // value must be a hydratable trial — otherwise `applySnapshot` would throw mid-hydrate. Reject so
  // the caller falls back to the seeded store rather than crashing on corrupt interactiveState.
  if (!(selectedTrialLetter in trials)) return null;
  for (const [letter, trial] of entries) {
    if (!VALID_LETTERS.has(letter) || !isHydratableTrial(trial)) return null;
  }
  return {
    version: SAVED_STATE_VERSION,
    trials: trials as SavedState["trials"],
    selectedTrialLetter: selectedTrialLetter as TrialLetter,
  };
}
