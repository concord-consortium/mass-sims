import { UiStore as BaseUiStore } from "@concord-consortium/mass-sims-shared";
import type { Instance } from "mobx-state-tree";
import type { Outcome } from "../model/weather";

/**
 * A run in progress — the volatile descriptor `RootStore.beginRun` arms and `finalizeRun`/`cancelRun`
 * clear. The `outcome` is captured at begin from the setup, so finalize commits exactly the outcome the
 * map animation depicted, never a re-evaluation. `runId` is the identity token that lets a finalize/cancel
 * callback reject a stale run it no longer owns.
 */
export interface NoreasterRun {
  readonly runId: number;
  readonly trial: string;
  readonly outcome: Outcome;
  /** True when the trial was already run at begin (a Replay) — carried into the finalize analytics. */
  readonly replay: boolean;
}

/**
 * Per-session UI state: the shared `UiStore` base plus the transient run machinery.
 *
 * - `runCompletedToken` — a `.volatile` counter bumped once per real Run (after the outcome is recorded).
 *   The Data-panel weather scene's "just finalized" fade signal, which can't be inferred from `outcome`
 *   alone (the same value arrives via Run, hydration, or trial-switch).
 * - `runId` / `run` — the deferred run animation's `.volatile` state: a monotonic id and the in-progress
 *   run descriptor. The run phase is what defers the outcome until the map animation ends.
 *
 * All three are `.volatile`: they never enter the snapshot, so a restore isn't read as a fresh Run
 * (wrongly faded) and a reload mid-run restores the trial as unrun (its outcome was never committed).
 */
export const UiStore = BaseUiStore.volatile(() => ({
  runCompletedToken: 0,
  runId: 0,
  run: null as NoreasterRun | null,
}))
  .actions((self) => {
    // Capture the base `selectTrial` so the override wraps it rather than replacing its body — the base's
    // letter write (and any validation it later grows) still runs instead of being dropped.
    const baseSelectTrial = self.selectTrial;
    return {
      /** Bump the fade token — once per real Run, after the outcome is recorded. */
      markRunCompleted() {
        self.runCompletedToken += 1;
      },
      /** Arm a new run: bump the id, store the descriptor, and return the id (the runner captures it). */
      armRun(trial: string, outcome: Outcome, replay: boolean): number {
        self.runId += 1;
        self.run = { runId: self.runId, trial, outcome, replay };
        return self.runId;
      },
      /** Clear the in-progress run (the finalize path). */
      clearRun() {
        self.run = null;
      },
      /** Cancel a run — unconditionally when `runId` is omitted, else only when it matches the live run. */
      cancelRun(runId?: number) {
        if (runId === undefined || self.run?.runId === runId) self.run = null;
      },
      /**
       * Override the base `selectTrial` to cancel any in-flight run before switching: switching away from a
       * running trial tears the run down at the source, so a stale finalize can't land on the
       * newly-selected trial.
       */
      selectTrial(letter: string) {
        self.run = null;
        baseSelectTrial(letter);
      },
    };
  })
  .views((self) => ({
    /** Whether `letter`'s trial is the one currently running. Drives control/selector locking + the map. */
    isRunning(letter: string): boolean {
      return self.run?.trial === letter;
    },
  }));

export type UiStoreInstance = Instance<typeof UiStore>;
