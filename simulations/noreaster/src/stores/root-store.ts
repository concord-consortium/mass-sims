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
import { evaluateOutcome, type Outcome } from "../model/weather";
import { emptyTrialSnapshot, TrialModel, type TrialModelInstance } from "./trial-model";
import { UiStore } from "./ui-store";

/** Result `finalizeRun` returns to the runner for analytics and narration. */
export interface FinalizedRun {
  trial: string;
  outcome: Outcome;
  replay: boolean;
}

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
      if (!trial) return;
      // Cancel a run targeting this trial before clearing it — the Trials-panel reset calls this directly
      // (no explicit cancel), and otherwise `finalizeRun` would commit the captured outcome onto the
      // emptied trial.
      if (self.ui.run?.trial === target) self.ui.cancelRun();
      trial.reset();
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
    /**
     * Begin a deferred run: capture the active trial's outcome from its setup without committing it (the
     * trial's `outcome` stays null through the map animation), arm the run descriptor, and return its
     * `runId`. Returns null unless the setup is complete. `finalizeRun` later commits exactly this captured
     * outcome. The control bar uses this path; `runActiveTrial` is the synchronous "run now, no animation"
     * primitive.
     */
    beginRun(): number | null {
      const trial = resolveActiveTrial(self.trials, self.ui.selectedTrialLetter);
      const setup = trial.setup;
      if (!setup) return null;
      return self.ui.armRun(self.ui.selectedTrialLetter, evaluateOutcome(setup), trial.hasRun);
    },
    /**
     * Finalize the run identified by `runId`: commit the captured outcome via `recordOutcome` (never a
     * re-evaluation), arm the Data-panel fade, and clear the descriptor. Returns null when `runId` doesn't
     * match the live run, dropping a stale callback from a canceled or superseded run. Returns the
     * committed run so the runner can emit analytics and narration.
     */
    finalizeRun(runId: number): FinalizedRun | null {
      const run = self.ui.run;
      if (!run || run.runId !== runId) return null;
      const trial = self.trials.get(run.trial);
      if (trial) trial.recordOutcome(run.outcome);
      self.ui.markRunCompleted();
      self.ui.clearRun();
      return { trial: run.trial, outcome: run.outcome, replay: run.replay };
    },
    /** Cancel the in-progress run (Reset / abort). Guarded clear via the ui store. */
    cancelRun(runId?: number) {
      self.ui.cancelRun(runId);
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
