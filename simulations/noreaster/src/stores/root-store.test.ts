import { renderHook } from "@testing-library/react";
import { getSnapshot } from "mobx-state-tree";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { createRootStore, RootStoreProvider, useStores } from "./root-store";
import { configureStrong, runStrong, STRONG_SETUP } from "./test-helpers";
import type { TrialModelInstance } from "./trial-model";

describe("createRootStore", () => {
  it("seeds a single unconfigured trial A, selected", () => {
    const store = createRootStore();
    expect(store.trialLetters).toEqual(["A"]);
    expect(store.ui.selectedTrialLetter).toBe("A");
    expect(store.activeTrial.setupComplete).toBe(false);
    expect(store.activeTrial.outcome).toBeNull();
  });
});

describe("RootStore.addTrial", () => {
  it("appends the next letter", () => {
    const store = createRootStore();
    expect(store.addTrial()).toBe("B");
    expect(store.trialLetters).toEqual(["A", "B"]);
  });

  it("returns null at the cap and does not grow past 10", () => {
    const store = createRootStore();
    while (store.canAddTrial) store.addTrial();
    expect(store.trialLetters).toHaveLength(10);
    expect(store.addTrial()).toBeNull();
    expect(store.trialLetters).toHaveLength(10);
  });
});

describe("RootStore.resetTrial (sim-local)", () => {
  it("clears the active trial back to unconfigured", () => {
    const store = createRootStore();
    runStrong(store.activeTrial);
    store.resetTrial();
    expect(store.activeTrial.outcome).toBeNull();
    expect(store.activeTrial.canReset).toBe(false);
  });

  it("resets the named trial without touching others", () => {
    const store = createRootStore();
    store.addTrial(); // B
    runStrong(store.trials.get("A") as TrialModelInstance);
    runStrong(store.trials.get("B") as TrialModelInstance);
    store.resetTrial("B");
    expect(store.trials.get("B")?.outcome).toBeNull();
    expect(store.trials.get("A")?.outcome).toBe("strong");
  });

  it("is a no-op for an unknown letter", () => {
    const store = createRootStore();
    expect(() => store.resetTrial("J")).not.toThrow();
  });
});

describe("RootStore deferred run (beginRun / finalizeRun / cancelRun)", () => {
  it("beginRun captures the outcome and arms the run without committing it", () => {
    const store = createRootStore();
    configureStrong(store.activeTrial);
    const runId = store.beginRun();
    expect(runId).not.toBeNull();
    expect(store.ui.run).toMatchObject({ runId, trial: "A", outcome: "strong", replay: false });
    expect(store.ui.run?.setup).toEqual(STRONG_SETUP);
    expect(store.ui.isRunning("A")).toBe(true);
    expect(store.activeTrial.outcome).toBeNull(); // deferred: not committed until finalize
  });

  it("beginRun is a no-op (returns null) until the setup is complete", () => {
    const store = createRootStore();
    store.activeTrial.setLandPathway("N/NW");
    expect(store.beginRun()).toBeNull();
    expect(store.ui.run).toBeNull();
  });

  it("finalizeRun commits the CAPTURED outcome even if the setup is mutated mid-run", () => {
    const store = createRootStore();
    configureStrong(store.activeTrial);
    const runId = store.beginRun() as number;
    // Mid-run the trial isn't locked yet (outcome still null), so a stray/programmatic setter can change
    // the would-be outcome. It must NOT change what finalize records — the captured outcome wins.
    store.activeTrial.setLandHumidity("Humid"); // setup would now evaluate to humidNoStorm, not strong
    const done = store.finalizeRun(runId);
    expect(done).toMatchObject({ trial: "A", outcome: "strong", replay: false });
    // finalize returns the CAPTURED setup, not the mutated live selections.
    expect(done?.setup).toEqual(STRONG_SETUP);
    expect(store.activeTrial.outcome).toBe("strong");
    expect(store.ui.run).toBeNull();
  });

  it("finalizeRun arms the fade token once, and only for the matching runId", () => {
    const store = createRootStore();
    configureStrong(store.activeTrial);
    const before = store.ui.runCompletedToken;
    const runId = store.beginRun() as number;

    expect(store.finalizeRun(runId + 999)).toBeNull(); // stale id → nothing happens
    expect(store.ui.runCompletedToken).toBe(before);
    expect(store.ui.isRunning("A")).toBe(true);

    expect(store.finalizeRun(runId)).not.toBeNull(); // matching id → commit + bump once
    expect(store.ui.runCompletedToken).toBe(before + 1);
    expect(store.activeTrial.outcome).toBe("strong");
  });

  it("a stale finalize after cancel + re-begin does not double-commit", () => {
    const store = createRootStore();
    configureStrong(store.activeTrial);
    const first = store.beginRun() as number;
    store.cancelRun(); // Run A canceled…
    const second = store.beginRun() as number; // …and begun again
    expect(second).toBeGreaterThan(first);

    expect(store.finalizeRun(first)).toBeNull(); // the first run's stale finalize is dropped
    expect(store.ui.isRunning("A")).toBe(true); // the second run is still live
    expect(store.finalizeRun(second)).not.toBeNull();
  });

  it("cancelRun(runId) cancels only the matching run; bare cancelRun() clears any", () => {
    const store = createRootStore();
    configureStrong(store.activeTrial);
    const runId = store.beginRun() as number;
    store.cancelRun(runId + 1); // non-matching → no-op
    expect(store.ui.isRunning("A")).toBe(true);
    store.cancelRun(); // unconditional
    expect(store.ui.run).toBeNull();
  });

  it("switching trials cancels an in-flight run (selectTrial override)", () => {
    const store = createRootStore();
    store.addTrial(); // B
    configureStrong(store.activeTrial); // A
    store.beginRun();
    expect(store.ui.isRunning("A")).toBe(true);
    store.ui.selectTrial("B");
    expect(store.ui.run).toBeNull();
    expect(store.ui.isRunning("A")).toBe(false);
  });

  it("resetTrial cancels a run targeting the reset trial (every reset entry point is safe)", () => {
    const store = createRootStore();
    configureStrong(store.activeTrial);
    const runId = store.beginRun() as number;
    expect(store.ui.isRunning("A")).toBe(true);

    // The Trials-panel reset calls resetTrial directly (no explicit cancel). Resetting the running trial
    // must tear the run down at the source, or finalize would commit the captured outcome onto the emptied
    // trial (a locked trial with no selections).
    store.resetTrial(); // defaults to the selected trial A
    expect(store.ui.run).toBeNull();
    expect(store.finalizeRun(runId)).toBeNull(); // the stale finalize is a no-op — no outcome committed
    expect(store.activeTrial.outcome).toBeNull();
    expect(store.activeTrial.canReset).toBe(false); // A is empty
  });

  it("resetTrial on a DIFFERENT trial leaves an in-flight run untouched", () => {
    const store = createRootStore();
    store.addTrial(); // B
    configureStrong(store.activeTrial); // A
    store.beginRun();
    expect(store.ui.isRunning("A")).toBe(true);

    store.resetTrial("B"); // resetting a non-running trial must not cancel A's run
    expect(store.ui.isRunning("A")).toBe(true);
    expect(store.ui.run).not.toBeNull();
  });

  it("beginRun on an already-run trial flags replay: true and re-commits the same outcome", () => {
    const store = createRootStore();
    runStrong(store.activeTrial); // already run
    const runId = store.beginRun() as number;
    expect(store.ui.run?.replay).toBe(true);
    expect(store.finalizeRun(runId)?.replay).toBe(true);
    expect(store.activeTrial.outcome).toBe("strong"); // unchanged (recordOutcome no-ops when locked)
  });
});

describe("RootStore views consume the shared logic", () => {
  it("activeTrial falls back to the first trial on a dangling selection", () => {
    const store = createRootStore();
    // "B" is a valid letter but absent → fall back to A rather than throw.
    store.ui.selectTrial("B");
    expect(store.activeTrial).toBe(store.trials.get("A"));
  });

  it("hasAnyProgress is true after a single selection in any trial (not just after a run)", () => {
    const store = createRootStore();
    store.addTrial(); // B
    expect(store.hasAnyProgress).toBe(false);
    // One selection in a non-active trial already counts as progress.
    store.trials.get("B")?.setLandHumidity("Dry");
    expect(store.ui.selectedTrialLetter).toBe("A");
    expect(store.hasAnyProgress).toBe(true);
  });

  it("snapshots to the { trials, ui } MST shape", () => {
    const store = createRootStore();
    const snap = getSnapshot(store);
    expect(Object.keys(snap)).toEqual(["trials", "ui"]);
    expect(snap.ui.selectedTrialLetter).toBe("A");
    expect(Object.keys(snap.trials)).toEqual(["A"]);
  });
});

describe("RootStoreProvider / useStores", () => {
  it("provides the store to consumers", () => {
    const store = createRootStore();
    const { result } = renderHook(() => useStores(), {
      wrapper: ({ children }) => createElement(RootStoreProvider, { store, children }),
    });
    expect(result.current).toBe(store);
  });

  it("throws when used outside a provider", () => {
    expect(() => renderHook(() => useStores())).toThrow(/RootStoreProvider/);
  });
});
