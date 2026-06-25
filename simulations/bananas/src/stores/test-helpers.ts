import type { SnapshotIn } from "mobx-state-tree";
import { RootStore, type RootStoreInstance } from "./root-store";
import { emptyTrialSnapshot, type TrialModel } from "./trial-model";
import type { UiStore } from "./ui-store";

type TrialOverride = Partial<SnapshotIn<typeof TrialModel>>;

/**
 * Overrides accepted by `createTestStore`. All halves are optional and PARTIAL.
 *
 * - `trial` — single-trial sugar: seeds trial "A" from a partial trial snapshot (the common case).
 * - `trials` — multi-trial: a Record keyed by letter; each value PARTIAL-merges onto an empty trial.
 *   Use this for the per-trial selection-memory tests. Takes precedence over `trial`.
 * - `ui` — partial UI snapshot (`selectedTrialLetter` / `selectedCrossByTrial`).
 */
type TestStoreOverrides = {
  trial?: TrialOverride;
  trials?: Record<string, TrialOverride>;
  ui?: Partial<SnapshotIn<typeof UiStore>>;
};

type TrialSnapshot = SnapshotIn<typeof TrialModel>;

function buildTrials(overrides?: TestStoreOverrides): Record<string, TrialSnapshot> {
  // Each value merges a partial override onto a full empty trial, so the result is a complete
  // snapshot (the cast restores that from the Partial-widened spread type).
  const merge = (trial?: TrialOverride): TrialSnapshot =>
    ({ ...emptyTrialSnapshot(), ...trial }) as TrialSnapshot;
  if (overrides?.trials) {
    return Object.fromEntries(
      Object.entries(overrides.trials).map(([letter, trial]) => [letter, merge(trial)]),
    );
  }
  return { A: merge(overrides?.trial) };
}

/**
 * Build a `RootStore` for tests with sensible defaults, optionally overridden.
 *
 * Defaults: a single empty trial "A" (no parents, no crosses, fungus off), `selectedTrialLetter:
 * "A"`, no cross selection, and `rng = Math.random`. Everything is optional — `createTestStore()`
 * with no arguments yields a pristine single-trial store.
 *
 * Merge semantics: each trial snapshot SHALLOW-MERGES onto an empty trial rather than replacing it,
 * so `createTestStore({ trial: { p1: "wild-w1" } })` keeps the default `locked: false`,
 * `fungusOn: false`, `crosses: []` and only sets `p1`. Pass a seeded PRNG via `opts.rng` (e.g.
 * `seededRandom("my-test")`) when a test needs deterministic crosses.
 */
export function createTestStore(
  overrides?: TestStoreOverrides,
  opts?: { rng?: () => number },
): RootStoreInstance {
  return RootStore.create(
    {
      trials: buildTrials(overrides),
      ui: { selectedTrialLetter: "A", selectedCrossByTrial: {}, ...overrides?.ui },
    },
    { rng: opts?.rng ?? Math.random },
  );
}
