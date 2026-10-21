import { renderHook } from "@testing-library/react";
import { getSnapshot } from "mobx-state-tree";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { SimOutput, SimTransient } from "../model/types";
import { createRootStore, RootStoreProvider, useStores } from "./root-store";

const OUTPUT: SimOutput = { avgDistance: 12.3, stdDevDistance: 2.1, avgDistanceSeries: [1, 2, 3] };
const TRANSIENT: SimTransient = {
  frame: 200,
  walkers: [{ x: 1, y: 1 }],
  avgDistanceSeries: [1, 2, 3],
};

/**
 * A self-contained deterministic RNG (LCG). Unlike the shared `seededRandom`, which is keyed and
 * stateful across calls, two `makeRng(n)` with the same `n` are independent and produce identical
 * sequences — exactly what the determinism-seam test needs.
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
    for (const letter of store.trialLetters) expect(store.trials.get(letter)?.output).toBeNull();
  });

  it("gives each seeded trial a distinct seed", () => {
    const store = createRootStore({ rng: makeRng(2) });
    const seeds = store.trialLetters.map((letter) => store.trials.get(letter)?.input.seed);
    expect(new Set(seeds).size).toBe(4);
  });

  it("RNG injection is the determinism seam: same seeded PRNG → same trial seed", () => {
    const a = createRootStore({ rng: makeRng(7) });
    const b = createRootStore({ rng: makeRng(7) });
    expect(a.activeTrial.input.seed).toBe(b.activeTrial.input.seed);

    const c = createRootStore({ rng: makeRng(99) });
    expect(c.activeTrial.input.seed).not.toBe(a.activeTrial.input.seed);
  });
});

describe("RootStore.canAddTrial", () => {
  it("is always false (the four trials are fixed)", () => {
    expect(createRootStore({ rng: makeRng(3) }).canAddTrial).toBe(false);
  });
});

describe("RootStore.resetTrial (sim-local)", () => {
  it("clears the active trial's output but keeps its input/seed", () => {
    const store = createRootStore({ rng: makeRng(4) });
    const seedBefore = store.activeTrial.input.seed;
    store.activeTrial.setOutput(OUTPUT, TRANSIENT);
    store.resetTrial();
    expect(store.activeTrial.output).toBeNull();
    expect(store.activeTrial.finalTransient).toBeNull();
    expect(store.activeTrial.input.seed).toBe(seedBefore);
  });

  it("resets the named trial without touching others", () => {
    const store = createRootStore({ rng: makeRng(5) });
    store.trials.get("A")?.setOutput(OUTPUT, TRANSIENT);
    store.trials.get("B")?.setOutput(OUTPUT, TRANSIENT);
    store.resetTrial("B");
    expect(store.trials.get("B")?.output).toBeNull();
    expect(store.trials.get("A")?.output).toEqual(OUTPUT);
  });

  it("is a no-op for an unknown letter", () => {
    const store = createRootStore({ rng: makeRng(6) });
    expect(() => store.resetTrial("J")).not.toThrow();
  });
});

describe("RootStore views consume the shared logic", () => {
  it("activeTrial falls back to the first trial on a dangling selection", () => {
    const store = createRootStore({ rng: makeRng(7) });
    // "E" is a valid letter but absent → fall back to A rather than throw.
    store.ui.selectTrial("E");
    expect(store.activeTrial).toBe(store.trials.get("A"));
  });

  it("hasAnyProgress reflects any trial having output, not just the active one", () => {
    const store = createRootStore({ rng: makeRng(8) });
    expect(store.hasAnyProgress).toBe(false);
    store.trials.get("B")?.setOutput(OUTPUT, TRANSIENT);
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
