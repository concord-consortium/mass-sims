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
import { emptyTrialSnapshot, TrialModel, type TrialModelInstance } from "./trial-model";
import { UiStore } from "./ui-store";

export const RootStore = types
  .model("Root", {
    trials: types.map(TrialModel),
    ui: UiStore,
  })
  .actions((self) => ({
    addTrial(): string | null {
      return addTrialToMap(self.trials, () => TrialModel.create(emptyTrialSnapshot()));
    },
    resetTrial(letter?: string) {
      const target = letter ?? self.ui.selectedTrialLetter;
      const trial = self.trials.get(target);
      if (trial) trial.reset();
    },
    /**
     * Run the active trial and, if it recorded an outcome, bump the fade signal — both inside ONE MST
     * action so they land in a single notification. This is the only path that should record an outcome:
     * keeping `run()` and `markRunCompleted()` together here means the Data-panel scene always reads a fresh
     * finalization (a `run()` without the bump would silently show the instant path instead of the fade).
     */
    runActiveTrial() {
      const trial = resolveActiveTrial(self.trials, self.ui.selectedTrialLetter);
      trial.run();
      if (trial.outcome) self.ui.markRunCompleted();
    },
  }))
  .views((self) => ({
    get activeTrial(): TrialModelInstance {
      return resolveActiveTrial(self.trials, self.ui.selectedTrialLetter);
    },
    get canAddTrial(): boolean {
      return computeCanAddTrial(self.trials);
    },
    get trialLetters(): readonly string[] {
      return listTrialLetters(self.trials);
    },
    get hasAnyProgress(): boolean {
      return anyTrialHasProgress(self.trials, (trial) => trial.canReset);
    },
  }));

export type RootStoreInstance = Instance<typeof RootStore>;
export type RootStoreSnapshotIn = SnapshotIn<typeof RootStore>;
export type RootStoreSnapshotOut = SnapshotOut<typeof RootStore>;

/**
 * Create a root store seeded with a single empty (unconfigured) trial "A". No RNG environment is
 * needed: a Nor'easter trial's outcome is fully determined by its air-mass selections (no
 * randomness), and a trial's identity is its letter.
 */
export function createRootStore() {
  return RootStore.create({
    trials: { A: emptyTrialSnapshot() },
    ui: { selectedTrialLetter: "A" },
  });
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

// Re-exported so callers (and the snapshot/hydrate path) have a single import site for snapshots.
export { getSnapshot };
