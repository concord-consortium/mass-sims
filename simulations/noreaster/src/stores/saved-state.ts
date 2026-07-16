import {
  TRIAL_LETTERS_DEFAULT,
  type TrialLetter,
  toVersionedSavedState,
} from "@concord-consortium/mass-sims-shared";
import type { RootStoreSnapshotOut } from "./root-store";
import type { TrialState } from "./trial-model";

export const SAVED_STATE_VERSION = 1;

const VALID_LETTERS = new Set<string>(TRIAL_LETTERS_DEFAULT);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A `SimInput` — carries the deterministic-identity seed. */
function isSimInput(value: unknown): boolean {
  return isObject(value) && typeof value.seed === "string";
}
/** A `SimOutput` — no fields are defined yet, so version 1 accepts only an empty object. */
function isSimOutput(value: unknown): boolean {
  return isObject(value) && Object.keys(value).length === 0;
}

/**
 * Whether a persisted trial value can hydrate into a `TrialModel`. `input` / `output` are stored as
 * `types.frozen`, so MST does NOT validate their inner shape — a malformed `input` would otherwise
 * hydrate a broken trial rather than falling back to the seeded store, so the field shapes are
 * checked explicitly here. `input` is required; `output` is nullable but must match when set.
 */
function isHydratableTrial(value: unknown): boolean {
  if (!isObject(value)) return false;
  const { input, output } = value;
  if (!isSimInput(input)) return false;
  if (output != null && !isSimOutput(output)) return false;
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
  // Every key must be a valid A–J letter and every value a hydratable trial, else `applySnapshot`
  // would throw mid-hydrate. A valid-but-absent `selectedTrialLetter` is NOT rejected — App's
  // normalization reaction re-selects the first trial, so the persisted trials are kept rather than
  // discarded (parity with Bananas).
  for (const [letter, trial] of entries) {
    if (!VALID_LETTERS.has(letter) || !isHydratableTrial(trial)) return null;
  }
  return {
    version: SAVED_STATE_VERSION,
    trials: trials as SavedState["trials"],
    selectedTrialLetter: selectedTrialLetter as TrialLetter,
  };
}
