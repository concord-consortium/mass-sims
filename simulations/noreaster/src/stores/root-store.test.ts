import { renderHook } from "@testing-library/react";
import { getSnapshot } from "mobx-state-tree";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { createRootStore, RootStoreProvider, useStores } from "./root-store";
import { runStrong } from "./test-helpers";
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
