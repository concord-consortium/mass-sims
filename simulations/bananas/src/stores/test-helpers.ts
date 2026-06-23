import type { SnapshotIn } from "mobx-state-tree";
import { RootStore, type RootStoreInstance } from "./root-store";
import { emptyTrialSnapshot, type TrialModel } from "./trial-model";
import type { UiStore } from "./ui-store";

/**
 * Overrides accepted by `createTestStore`. Both halves are optional and PARTIAL — any subset of
 * `trial` / `ui` fields shallow-merges onto the defaults, so callers state only what they care
 * about (e.g. `{ trial: { p1: "wild-w1" } }`).
 */
type TestStoreOverrides = {
  trial?: Partial<SnapshotIn<typeof TrialModel>>;
  ui?: Partial<SnapshotIn<typeof UiStore>>;
};

/**
 * Build a `RootStore` for tests with sensible defaults, optionally overridden.
 *
 * Defaults: an empty trial (no parents, no crosses, fungus off), `ui.selectedCross = null`, and
 * `rng = Math.random`. Everything is optional — `createTestStore()` with no arguments yields a
 * pristine store.
 *
 * Merge semantics: `overrides.trial` and `overrides.ui` SHALLOW-MERGE onto the defaults rather
 * than replacing them, so `createTestStore({ trial: { p1: "wild-w1" } })` keeps the default
 * `locked: false`, `fungusOn: false`, `crosses: []` and only sets `p1`. Pass a seeded PRNG via
 * `opts.rng` (e.g. `seededRandom("my-test")`) when a test needs deterministic crosses.
 */
export function createTestStore(
  overrides?: TestStoreOverrides,
  opts?: { rng?: () => number },
): RootStoreInstance {
  return RootStore.create(
    {
      trial: { ...emptyTrialSnapshot(), ...overrides?.trial },
      ui: { selectedCross: null, ...overrides?.ui },
    },
    { rng: opts?.rng ?? Math.random },
  );
}
