import {
  getSnapshot,
  type Instance,
  type SnapshotIn,
  type SnapshotOut,
  types,
} from "mobx-state-tree";
import { createContext, createElement, type ReactNode, useContext } from "react";
import {
  aggregateTotals,
  computeResistanceSeries,
  type PhenotypeTotals,
  type ResistanceSeries,
} from "../model/data-aggregations";
import { emptyTrialSnapshot, TrialModel } from "./trial-model";
import { UiStore } from "./ui-store";

export const RootStore = types
  .model("Root", {
    trial: TrialModel,
    ui: UiStore,
  })
  .actions((self) => ({
    // Cross-store action: Reset clears both the trial and the selection.
    resetTrial() {
      self.trial.reset();
      self.ui.clearSelection();
    },
    // Defensive normalizer for an out-of-range selectedCross: the index is invalid if it's
    // negative OR past the end. Either case → clear back to `null` so chart code that indexes
    // `trial.crosses[selectedCross]` can't crash. Driven by a reaction on `crosses.length`.
    normalizeSelection() {
      const sel = self.ui.selectedCross;
      if (sel !== null && (sel < 0 || sel >= self.trial.crosses.length)) {
        self.ui.clearSelection();
      }
    },
  }))
  .views((self) => ({
    /**
     * The currently-active cross index, or `null` when nothing valid is selected. "Active" means
     * a non-null `ui.selectedCross` that's within the bounds of `trial.crosses`.
     *
     * CONTRACT — required reading: no consumer outside this store may index `trial.crosses[...]`
     * with `ui.selectedCross` directly. All such access goes through `activeCross`, which
     * re-applies the bounds check on every read. Between the moment `crosses` shrinks (Reset) and
     * the moment the `normalizeSelection` reaction fires, `ui.selectedCross` can be
     * stale-but-out-of-range; reading it directly would crash. Consumers that gate on
     * `activeCross !== null` are race-free by construction. The `normalizeSelection` reaction is
     * the durable cleanup; this view is the defense-in-depth read-side guard — intentionally
     * redundant, belt and suspenders.
     */
    get activeCross(): number | null {
      const sel = self.ui.selectedCross;
      const len = self.trial.crosses.length;
      return sel !== null && sel >= 0 && sel < len ? sel : null;
    },
    /** Phenotype counts in the currently-selected scope. `null` when there are no crosses yet. */
    get phenotypeTotals(): PhenotypeTotals | null {
      if (self.trial.crosses.length === 0) return null;
      const scope =
        this.activeCross !== null ? [self.trial.crosses[this.activeCross]] : self.trial.crosses;
      return aggregateTotals(scope);
    },
    /** Per-cross resistance series. `null` when there are no crosses yet. */
    get resistanceSeries(): ResistanceSeries | null {
      return self.trial.crosses.length === 0 ? null : computeResistanceSeries(self.trial.crosses);
    },
  }));

export type RootStoreInstance = Instance<typeof RootStore>;
export type RootStoreSnapshotIn = SnapshotIn<typeof RootStore>;

/**
 * Create a root store. The `rng` is passed as MST's *environment* (the second `create` argument)
 * rather than a stored property; actions read it via `getEnv(self)`. See the RNG NOTE on
 * `TrialModel` for why the environment is the right home. Production omits `rng` (defaults to
 * `Math.random`); tests pass a seeded PRNG for determinism.
 */
export function createRootStore({ rng = Math.random }: { rng?: () => number } = {}) {
  return RootStore.create({ trial: emptyTrialSnapshot(), ui: { selectedCross: null } }, { rng });
}

const RootStoreContext = createContext<RootStoreInstance | null>(null);

export function RootStoreProvider({
  store,
  children,
}: {
  store: RootStoreInstance;
  children: ReactNode;
}) {
  return createElement(RootStoreContext.Provider, { value: store }, children);
}

export function useStores(): RootStoreInstance {
  const store = useContext(RootStoreContext);
  if (!store) throw new Error("useStores() called outside RootStoreProvider");
  return store;
}

// Re-exported so callers (and the snapshot/hydrate path) have a single import site for snapshot
// helpers when needed.
export { getSnapshot };
export type RootStoreSnapshotOut = SnapshotOut<typeof RootStore>;
