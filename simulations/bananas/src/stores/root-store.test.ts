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
  it("clears both the trial and the selection", () => {
    const store = createTestStore({ trial: { crosses: [CROSS_A] }, ui: { selectedCross: 0 } });
    store.resetTrial();
    expect(getSnapshot(store.trial)).toEqual({
      p1: null,
      p2: null,
      locked: false,
      fungusOn: false,
      crosses: [],
    });
    expect(store.ui.selectedCross).toBeNull();
  });
});

describe("RootStore.normalizeSelection", () => {
  it("clears selectedCross when it is negative", () => {
    const store = createTestStore({ trial: { crosses: [CROSS_A] }, ui: { selectedCross: -1 } });
    store.normalizeSelection();
    expect(store.ui.selectedCross).toBeNull();
  });

  it("clears selectedCross when it is >= crosses.length", () => {
    const store = createTestStore({ trial: { crosses: [CROSS_A] }, ui: { selectedCross: 5 } });
    store.normalizeSelection();
    expect(store.ui.selectedCross).toBeNull();
  });

  it("leaves a valid selectedCross untouched", () => {
    const store = createTestStore({
      trial: { crosses: [CROSS_A, CROSS_B] },
      ui: { selectedCross: 1 },
    });
    store.normalizeSelection();
    expect(store.ui.selectedCross).toBe(1);
  });
});

describe("RootStore.activeCross", () => {
  it("returns the raw selectedCross when in range", () => {
    const store = createTestStore({ trial: { crosses: [CROSS_A] }, ui: { selectedCross: 0 } });
    expect(store.activeCross).toBe(0);
  });

  it("returns null when selectedCross is out of range (defense-in-depth read guard)", () => {
    const store = createTestStore({ trial: { crosses: [CROSS_A] }, ui: { selectedCross: 3 } });
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
      ui: { selectedCross: 0 },
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
      ui: { selectedCross: 0 },
    });
    // Cross A: 2/3 healthy → 67%. Cross B: 1/2 healthy → 50%.
    expect(store.resistanceSeries).toEqual({ healthy: [67, 50], infected: [33, 50] });
  });
});

describe("RootStore snapshot cleanliness (RNG isolation)", () => {
  it("never serializes the injected rng onto the trial snapshot", () => {
    const store = createRootStore({ rng: () => 0.5 });
    store.trial.setP1(W1);
    store.trial.setP2(C1);
    store.trial.crossPlants();
    store.trial.crossPlants();
    const json = JSON.stringify(getSnapshot(store.trial));
    expect(json).not.toContain("rng");
    expect(json).not.toContain("function");
  });
});
