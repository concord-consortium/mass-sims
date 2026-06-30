import {
  addTrial as addTrialToMap,
  hasAnyProgress as anyTrialHasProgress,
  canAddTrial as computeCanAddTrial,
  trialLetters as listTrialLetters,
  activeTrial as resolveActiveTrial,
} from "@concord-consortium/mass-sims-shared";
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
import { emptyTrialSnapshot, TrialModel, type TrialModelInstance } from "./trial-model";
import { UiStore } from "./ui-store";

export const RootStore = types
  .model("Root", {
    // Keyed by letter "A".."J"; initially { A: emptyTrialSnapshot() }. A Map (not an array) because
    // the key IS the trial's identity, and Maps snapshot as plain Record<string, …> for LARA.
    trials: types.map(TrialModel),
    ui: UiStore,
  })
  .actions((self) => ({
    // Reset the named trial (defaults to active). Clears that trial's per-trial cross selection too
    // — the only mutation that shrinks a trial's crosses, so the only one that can leave a stored
    // cross-row index dangling. Other consumers (the activeCross view's bounds check) are
    // belt-and-suspenders.
    resetTrial(letter?: string) {
      const target = letter ?? self.ui.selectedTrialLetter;
      const trial = self.trials.get(target);
      if (!trial) return; // Defensive: no-op if the letter is unknown. Shouldn't happen via locked actions.
      trial.reset();
      self.ui.clearSelectionForTrial(target);
    },
    // Add a trial at the next-available letter, up to the cap. Returns the new letter, or `null` if
    // at cap — callers must gate on the return value.
    addTrial(): string | null {
      return addTrialToMap(self.trials, () => TrialModel.create(emptyTrialSnapshot()));
    },
  }))
  .views((self) => ({
    /**
     * The trial currently being displayed. NEVER throws on a dangling `selectedTrialLetter` — it
     * falls back to the first trial in the Map (always "A" in practice, since A is seeded by
     * `createRootStore` and no action removes trials). The App-level normalization reaction fixes up
     * the letter on the next render cycle; this fallback is the read-side belt-and-suspenders so
     * consumers can read `activeTrial` unconditionally and never crash mid-render.
     */
    get activeTrial(): TrialModelInstance {
      return resolveActiveTrial(self.trials, self.ui.selectedTrialLetter);
    },
    get canAddTrial(): boolean {
      return computeCanAddTrial(self.trials);
    },
    get trialLetters(): readonly string[] {
      return listTrialLetters(self.trials);
    },
    /**
     * True if any trial has progress (parents picked, fungus toggled, or crosses made). Drives the
     * reload-warning hook — the user has unsaved work in *any* trial, not just the active one.
     */
    get hasAnyProgress(): boolean {
      return anyTrialHasProgress(self.trials, (trial) => trial.canReset);
    },
    /**
     * The active trial's currently-active cross index, or `null` when nothing valid is selected.
     * Sourced from the per-trial `selectedCrossByTrial` map and re-bounds-checked against the active
     * trial's crosses on every read.
     *
     * CONTRACT — required reading: no consumer outside this store may index `crosses[...]` with the
     * raw stored selection directly. All such access goes through `activeCross`, which re-applies the
     * bounds check on every read. Consumers that gate on `activeCross !== null` are race-free by
     * construction.
     */
    get activeCross(): number | null {
      const sel = self.ui.selectedCrossByTrial.get(self.ui.selectedTrialLetter) ?? null;
      const len = this.activeTrial.crosses.length;
      return sel !== null && sel >= 0 && sel < len ? sel : null;
    },
    /** Phenotype counts in the currently-selected scope. `null` when there are no crosses yet. */
    get phenotypeTotals(): PhenotypeTotals | null {
      const crosses = this.activeTrial.crosses;
      if (crosses.length === 0) return null;
      const scope = this.activeCross !== null ? [crosses[this.activeCross]] : crosses;
      return aggregateTotals(scope);
    },
    /** Per-cross resistance series. `null` when there are no crosses yet. */
    get resistanceSeries(): ResistanceSeries | null {
      const crosses = this.activeTrial.crosses;
      return crosses.length === 0 ? null : computeResistanceSeries(crosses);
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
  return RootStore.create(
    {
      trials: { A: emptyTrialSnapshot() },
      ui: { selectedTrialLetter: "A", selectedCrossByTrial: {} },
    },
    { rng },
  );
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
