import {
  TRIAL_LETTERS_DEFAULT,
  type TrialLetter,
  toVersionedSavedState,
} from "@concord-consortium/mass-sims-shared";
import {
  HUMIDITIES,
  LAND_PATHWAYS,
  LAND_TEMPERATURES,
  OCEAN_PATHWAYS,
  OUTCOMES,
} from "../model/weather";
import type { RootStoreSnapshotOut } from "./root-store";
import type { TrialState } from "./trial-model";

export const SAVED_STATE_VERSION = 1;

const VALID_LETTERS = new Set<string>(TRIAL_LETTERS_DEFAULT);

// One membership set per field, sourced from the same value arrays the MST enumerations use, so the
// validator's accepted set can't drift from what `applySnapshot` will accept.
const LAND_PATHWAY_SET = new Set<string>(LAND_PATHWAYS);
const OCEAN_PATHWAY_SET = new Set<string>(OCEAN_PATHWAYS);
const HUMIDITY_SET = new Set<string>(HUMIDITIES);
const LAND_TEMPERATURE_SET = new Set<string>(LAND_TEMPERATURES);
const OUTCOME_SET = new Set<string>(OUTCOMES);

// The exact set of keys a persisted trial must carry — the five selections plus the recorded outcome.
const TRIAL_KEYS = [
  "landPathway",
  "landHumidity",
  "landTemperature",
  "oceanPathway",
  "oceanHumidity",
  "outcome",
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A field value is hydratable when it is `null` or one of its enumeration's members. */
function isNullableMember(value: unknown, allowed: Set<string>): boolean {
  return value === null || (typeof value === "string" && allowed.has(value));
}

/**
 * Whether a persisted trial value can hydrate into a `TrialModel`. The fields are `types.enumeration`,
 * so an out-of-range value would THROW in `applySnapshot` rather than fall back to the fresh store —
 * hence membership is gated up front. Three checks:
 *
 *  1. Exact keys — the object carries exactly `TRIAL_KEYS` (no missing, no extra). Rejects the old
 *     seed-only shape and any obsolete/malformed trial.
 *  2. Per-field membership — each selection is `null` or a valid value; `outcome` is `null` or a
 *     valid `Outcome`.
 *  3. Cross-field invariant — a recorded `outcome` is only valid when ALL five selections are set.
 *     (Otherwise the trial would hydrate `locked` — lock derives from `outcome` — while `setupComplete`
 *     is false: read-only incomplete inputs with a disabled Replay.)
 *
 * A historically recorded outcome is NOT recomputed/compared here — MAS-39 will change the
 * setup→outcome mapping, and re-deriving would rewrite old trials. Only structural consistency is
 * validated, not the outcome's value.
 */
function isHydratableTrial(value: unknown): boolean {
  if (!isObject(value)) return false;

  // 1. Exact keys.
  if (Object.keys(value).length !== TRIAL_KEYS.length) return false;
  for (const key of TRIAL_KEYS) {
    if (!(key in value)) return false;
  }

  // 2. Per-field membership.
  if (!isNullableMember(value.landPathway, LAND_PATHWAY_SET)) return false;
  if (!isNullableMember(value.landHumidity, HUMIDITY_SET)) return false;
  if (!isNullableMember(value.landTemperature, LAND_TEMPERATURE_SET)) return false;
  if (!isNullableMember(value.oceanPathway, OCEAN_PATHWAY_SET)) return false;
  if (!isNullableMember(value.oceanHumidity, HUMIDITY_SET)) return false;
  if (!isNullableMember(value.outcome, OUTCOME_SET)) return false;

  // 3. Cross-field invariant: an outcome requires a complete setup.
  if (value.outcome !== null) {
    const setupComplete =
      value.landPathway !== null &&
      value.landHumidity !== null &&
      value.landTemperature !== null &&
      value.oceanPathway !== null &&
      value.oceanHumidity !== null;
    if (!setupComplete) return false;
  }

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
