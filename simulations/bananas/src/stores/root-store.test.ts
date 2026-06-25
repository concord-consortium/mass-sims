import { getSnapshot } from "mobx-state-tree";
import { describe, expect, it } from "vitest";
import type { OffspringPlant, ParentId } from "../model/genetics";
import { createRootStore } from "./root-store";
import { createTestStore } from "./test-helpers";

const W1: ParentId = "wild-w1";
const C1: ParentId = "cavendish-c1";

/** Build an offspring plant fixture; only `infected` matters for the aggregation views. */
function plant(infected: boolean): OffspringPlant {
  return { genotype: infected ? "rr" : "Rr", isResistant: !infected, infected };
}

// Cross A: 2 healthy + 1 infected (3 plants). Cross B: 1 healthy + 1 infected (2 plants).
const CROSS_A = [plant(false), plant(false), plant(true)];
const CROSS_B = [plant(false), plant(true)];

describe("RootStore.resetTrial", () => {
  it("clears both the active trial and its selection", () => {
    const store = createTestStore({
      trial: { crosses: [CROSS_A] },
      ui: { selectedCrossByTrial: { A: 0 } },
    });
    store.resetTrial();
    expect(getSnapshot(store.activeTrial)).toEqual({
      p1: null,
      p2: null,
      locked: false,
      fungusOn: false,
      crosses: [],
    });
    expect(store.ui.selectedCrossByTrial.has("A")).toBe(false);
  });

  it("resets the named trial without touching others, clearing only its selection", () => {
    const store = createTestStore({
      trials: {
        A: { p1: W1, crosses: [CROSS_A] },
        B: { p1: C1, crosses: [CROSS_B] },
      },
      ui: { selectedCrossByTrial: { A: 0, B: 0 } },
    });
    store.resetTrial("B");
    // B is wiped…
    expect(store.trials.get("B")?.canReset).toBe(false);
    expect(store.ui.selectedCrossByTrial.has("B")).toBe(false);
    // …A is untouched, including its selection.
    expect(store.trials.get("A")?.p1).toBe(W1);
    expect(store.trials.get("A")?.crosses).toHaveLength(1);
    expect(store.ui.selectedCrossByTrial.get("A")).toBe(0);
  });
});

describe("RootStore.addTrial", () => {
  it("appends the next letter from the initial single-trial state", () => {
    const store = createTestStore();
    expect(store.addTrial()).toBe("B");
    expect(store.trialLetters).toEqual(["A", "B"]);
  });

  it("yields 'J' when adding the 10th trial", () => {
    const store = createTestStore({
      trials: { A: {}, B: {}, C: {}, D: {}, E: {}, F: {}, G: {}, H: {}, I: {} },
    });
    expect(store.addTrial()).toBe("J");
    expect(store.trials.size).toBe(10);
  });

  it("returns null and does not mutate when at the 10-trial cap", () => {
    const store = createTestStore({
      trials: { A: {}, B: {}, C: {}, D: {}, E: {}, F: {}, G: {}, H: {}, I: {}, J: {} },
    });
    expect(store.canAddTrial).toBe(false);
    expect(store.addTrial()).toBeNull();
    expect(store.trials.size).toBe(10);
  });
});

describe("RootStore per-trial selection memory", () => {
  it("round-trips selectedCross across ≥ 3 trials and repeated switches", () => {
    // A has 2 crosses, B has 1, C has 3 — enough that each remembered index is in range.
    const store = createTestStore({
      trials: {
        A: { crosses: [CROSS_A, CROSS_B] },
        B: { crosses: [CROSS_A] },
        C: { crosses: [CROSS_A, CROSS_B, CROSS_A] },
      },
    });

    store.ui.selectCross(1); // active A
    store.ui.selectTrial("B");
    store.ui.selectCross(0); // active B
    store.ui.selectTrial("C");
    store.ui.selectCross(2); // active C

    // Now cycle and confirm each trial remembers its own selection.
    store.ui.selectTrial("A");
    expect(store.activeCross).toBe(1);
    store.ui.selectTrial("B");
    expect(store.activeCross).toBe(0);
    store.ui.selectTrial("C");
    expect(store.activeCross).toBe(2);
    store.ui.selectTrial("A");
    expect(store.activeCross).toBe(1);
  });
});

describe("RootStore.activeCross", () => {
  it("returns the raw selectedCross when in range", () => {
    const store = createTestStore({
      trial: { crosses: [CROSS_A] },
      ui: { selectedCrossByTrial: { A: 0 } },
    });
    expect(store.activeCross).toBe(0);
  });

  it("returns null when selectedCross is out of range (defense-in-depth read guard)", () => {
    const store = createTestStore({
      trial: { crosses: [CROSS_A] },
      ui: { selectedCrossByTrial: { A: 3 } },
    });
    expect(store.activeCross).toBeNull();
  });

  it("returns null when nothing is selected", () => {
    const store = createTestStore({ trial: { crosses: [CROSS_A] } });
    expect(store.activeCross).toBeNull();
  });
});

describe("RootStore.phenotypeTotals", () => {
  it("is null when there are no crosses", () => {
    const store = createTestStore();
    expect(store.phenotypeTotals).toBeNull();
  });

  it("aggregates across all crosses when nothing is selected", () => {
    const store = createTestStore({ trial: { crosses: [CROSS_A, CROSS_B] } });
    expect(store.phenotypeTotals).toEqual({ healthy: 3, infected: 2 });
  });

  it("scopes to the selected cross", () => {
    const store = createTestStore({
      trial: { crosses: [CROSS_A, CROSS_B] },
      ui: { selectedCrossByTrial: { A: 0 } },
    });
    expect(store.phenotypeTotals).toEqual({ healthy: 2, infected: 1 });
  });
});

describe("RootStore.resistanceSeries", () => {
  it("is null when there are no crosses", () => {
    const store = createTestStore();
    expect(store.resistanceSeries).toBeNull();
  });

  it("returns per-cross percentages (always all crosses, regardless of selection)", () => {
    const store = createTestStore({
      trial: { crosses: [CROSS_A, CROSS_B] },
      ui: { selectedCrossByTrial: { A: 0 } },
    });
    // Cross A: 2/3 healthy → 67%. Cross B: 1/2 healthy → 50%.
    expect(store.resistanceSeries).toEqual({ healthy: [67, 50], infected: [33, 50] });
  });
});

describe("RootStore.hasAnyProgress", () => {
  it("is false when every trial is empty", () => {
    const store = createTestStore({ trials: { A: {}, B: {} } });
    expect(store.hasAnyProgress).toBe(false);
  });

  it("is true when a non-active trial has progress", () => {
    const store = createTestStore({ trials: { A: {}, B: { p1: W1 } } });
    expect(store.activeTrial.canReset).toBe(false); // active trial A is empty…
    expect(store.hasAnyProgress).toBe(true); // …but B has progress.
  });
});

describe("RootStore snapshot cleanliness (RNG isolation)", () => {
  it("never serializes the injected rng onto the trial snapshot", () => {
    const store = createRootStore({ rng: () => 0.5 });
    store.activeTrial.setP1(W1);
    store.activeTrial.setP2(C1);
    store.activeTrial.crossPlants();
    store.activeTrial.crossPlants();
    const json = JSON.stringify(getSnapshot(store.activeTrial));
    expect(json).not.toContain("rng");
    expect(json).not.toContain("function");
  });
});
