import { renderHook } from "@testing-library/react";
import { getSnapshot } from "mobx-state-tree";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { roofAt } from "../model/erosion";
import { TIMELINE_VALUES } from "../model/timeline";
import { TRIAL_CONDITIONS } from "../trial-conditions";
import { createRootStore, RootStoreProvider, useStores } from "./root-store";

/**
 * A deterministic RNG (LCG). Unlike the shared `seededRandom`, which caches one stateful PRNG per
 * key, two `makeRng(n)` calls with the same `n` give independent, identical sequences.
 */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe("createRootStore", () => {
  it("seeds four empty trials A–D, in order, with A selected", () => {
    const store = createRootStore({ rng: makeRng(1) });
    expect(store.trialLetters).toEqual(["A", "B", "C", "D"]);
    expect(store.ui.selectedTrialLetter).toBe("A");
    for (const letter of store.trialLetters) {
      expect(store.trials.get(letter)?.hasSamples).toBe(false);
    }
  });

  it("RNG injection is the determinism seam: same seeded PRNG → same sampled rates", () => {
    const a = createRootStore({ rng: makeRng(7) });
    const b = createRootStore({ rng: makeRng(7) });
    expect(a.takeSample().rate).toBe(b.takeSample().rate);
  });
});

describe("RootStore.takeSample", () => {
  it("adds a sample to the selected trial only, at the timeline's year, and selects it", () => {
    const store = createRootStore({ rng: makeRng(11) });
    store.ui.selectTrial("B");
    store.ui.setTimelineIndex(TIMELINE_VALUES.indexOf(0));
    const sample = store.takeSample();
    expect(sample.years).toBe(0);
    expect(sample.roof).toBe(roofAt(TRIAL_CONDITIONS.B, 0));
    expect(store.trials.get("B")?.samples).toEqual([sample]);
    for (const letter of ["A", "C", "D"]) {
      expect(store.trials.get(letter)?.hasSamples).toBe(false);
    }
    expect(store.ui.selectedSampleId("B")).toBe(sample.id);
    expect(store.selectedSample).toEqual(sample);
  });

  it("gives two samples of the same year the same roof and different rates", () => {
    const store = createRootStore({ rng: makeRng(12) });
    const first = store.takeSample();
    const second = store.takeSample();
    expect(first.years).toBe(second.years);
    expect(first.roof).toBe(second.roof);
    expect(first.rate).not.toBe(second.rate);
    expect(store.ui.selectedSampleId("A")).toBe(second.id);
  });
});

describe("RootStore.deleteSample", () => {
  it("deletes the row and clears the selection when it was the selected row", () => {
    const store = createRootStore({ rng: makeRng(13) });
    const first = store.takeSample();
    const second = store.takeSample();
    store.deleteSample("A", second.id);
    expect(store.activeTrial.samples).toEqual([first]);
    expect(store.ui.selectedSampleId("A")).toBeNull();
    expect(store.selectedSample).toBeUndefined();
  });

  it("keeps the selection when another row is deleted", () => {
    const store = createRootStore({ rng: makeRng(14) });
    const first = store.takeSample();
    const second = store.takeSample();
    store.deleteSample("A", first.id);
    expect(store.ui.selectedSampleId("A")).toBe(second.id);
  });
});

describe("RootStore.canAddTrial", () => {
  it("is always false (the four trials are fixed)", () => {
    expect(createRootStore({ rng: makeRng(3) }).canAddTrial).toBe(false);
  });
});

describe("RootStore.resetTrial (sim-local)", () => {
  it("clears the active trial's rows and its selection", () => {
    const store = createRootStore({ rng: makeRng(4) });
    store.takeSample();
    store.resetTrial();
    expect(store.activeTrial.hasSamples).toBe(false);
    expect(store.ui.selectedSampleId("A")).toBeNull();
  });

  it("resets the named trial without touching others", () => {
    const store = createRootStore({ rng: makeRng(5) });
    store.takeSample();
    store.ui.selectTrial("B");
    store.takeSample();
    store.resetTrial("B");
    expect(store.trials.get("B")?.hasSamples).toBe(false);
    expect(store.trials.get("A")?.sampleCount).toBe(1);
    expect(store.ui.selectedSampleId("A")).toBe(1);
  });

  it("is a no-op for an unknown letter", () => {
    const store = createRootStore({ rng: makeRng(6) });
    expect(() => store.resetTrial("J")).not.toThrow();
  });
});

describe("RootStore views consume the shared logic", () => {
  it("activeTrial falls back to the first trial on a dangling selection", () => {
    const store = createRootStore({ rng: makeRng(7) });
    // "E" is a valid letter but names no trial, so this falls back to A instead of throwing.
    store.ui.selectTrial("E");
    expect(store.activeTrial).toBe(store.trials.get("A"));
  });

  it("hasAnyProgress reflects any trial having samples, not just the active one", () => {
    const store = createRootStore({ rng: makeRng(8) });
    expect(store.hasAnyProgress).toBe(false);
    store.trials.get("B")?.addSample({ years: 0, rate: 30, roof: 2800 });
    expect(store.ui.selectedTrialLetter).toBe("A");
    expect(store.hasAnyProgress).toBe(true);
  });

  it("snapshots to the { trials, ui } MST shape", () => {
    const store = createRootStore({ rng: makeRng(9) });
    const snap = getSnapshot(store);
    expect(Object.keys(snap)).toEqual(["trials", "ui"]);
    expect(snap.ui.selectedTrialLetter).toBe("A");
    expect(Object.keys(snap.trials)).toEqual(["A", "B", "C", "D"]);
  });
});

describe("RootStoreProvider / useStores", () => {
  it("provides the store to consumers", () => {
    const store = createRootStore({ rng: makeRng(10) });
    const { result } = renderHook(() => useStores(), {
      wrapper: ({ children }) => createElement(RootStoreProvider, { store, children }),
    });
    expect(result.current).toBe(store);
  });

  it("throws when used outside a provider", () => {
    expect(() => renderHook(() => useStores())).toThrow(/RootStoreProvider/);
  });
});
