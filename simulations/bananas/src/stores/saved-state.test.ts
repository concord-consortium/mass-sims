import { applySnapshot, getSnapshot } from "mobx-state-tree";
import { describe, expect, it } from "vitest";
import type { OffspringPlant, ParentId } from "../model/genetics";
import { createRootStore } from "./root-store";
import { type SavedState, toSavedState } from "./saved-state";
import { createTestStore } from "./test-helpers";
import type { TrialState } from "./trial-model";

const W1: ParentId = "wild-w1";
const C1: ParentId = "cavendish-c1";

function plant(infected: boolean): OffspringPlant {
  return { genotype: infected ? "rr" : "Rr", isResistant: !infected, infected };
}

const CROSS = [plant(false), plant(false), plant(true)];

describe("toSavedState", () => {
  it("projects { trials, selectedTrialLetter } and excludes selectedCrossByTrial", () => {
    const store = createTestStore({
      trials: { A: { p1: W1, p2: C1, locked: true, crosses: [CROSS] }, B: {} },
      ui: { selectedTrialLetter: "B", selectedCrossByTrial: { A: 0 } },
    });
    const saved = toSavedState(getSnapshot(store));
    expect(Object.keys(saved).sort()).toEqual(["selectedTrialLetter", "trials"]);
    expect(saved.selectedTrialLetter).toBe("B");
    expect(Object.keys(saved.trials).sort()).toEqual(["A", "B"]);
    // Transient UI selection is not part of the wire format.
    expect("selectedCrossByTrial" in saved).toBe(false);
    expect(JSON.stringify(saved)).not.toContain("selectedCrossByTrial");
  });
});

describe("SavedState round-trip", () => {
  it("reconstructs every trial and the active letter through save → hydrate (multi-trial)", () => {
    const source = createTestStore({
      trials: {
        A: { p1: W1, p2: C1, locked: true, crosses: [CROSS] },
        B: { p1: C1 },
        C: { p1: W1, p2: W1, locked: true, fungusOn: true, crosses: [CROSS, CROSS] },
      },
      ui: { selectedTrialLetter: "C", selectedCrossByTrial: { A: 0 } },
    });
    const saved = toSavedState(getSnapshot(source));

    // Hydrate a fresh store from the projected wire format.
    const target = createRootStore();
    applySnapshot(target, {
      trials: saved.trials,
      ui: { selectedTrialLetter: saved.selectedTrialLetter, selectedCrossByTrial: {} },
    });

    expect(target.trialLetters).toEqual(["A", "B", "C"]);
    expect(target.ui.selectedTrialLetter).toBe("C");
    // Re-projecting the hydrated store yields exactly what was saved — a full round-trip of every
    // trial's state plus the active letter.
    expect(toSavedState(getSnapshot(target))).toEqual(saved);
    expect(target.trials.get("B")?.p1).toBe(C1);
    expect(target.trials.get("C")?.fungusOn).toBe(true);
    expect(target.trials.get("C")?.crosses).toHaveLength(2);
    // UI selection is not restored.
    expect(target.ui.selectedCrossByTrial.size).toBe(0);
  });
});

describe("hydrate from a SavedState", () => {
  // Apply a SavedState the way App's hydrate effect does.
  function hydrate(state: SavedState) {
    const store = createRootStore();
    applySnapshot(store, {
      trials: state.trials,
      ui: { selectedTrialLetter: state.selectedTrialLetter, selectedCrossByTrial: {} },
    });
    return store;
  }

  it("restores a single trial 'A' with parents, crosses, and fungus", () => {
    const trialA: TrialState = {
      p1: W1,
      p2: C1,
      locked: true,
      fungusOn: true,
      crosses: [CROSS],
    };
    const store = hydrate({ trials: { A: trialA }, selectedTrialLetter: "A" });
    expect(store.trialLetters).toEqual(["A"]);
    expect(store.activeTrial.p1).toBe(W1);
    expect(store.activeTrial.p2).toBe(C1);
    expect(store.activeTrial.fungusOn).toBe(true);
    expect(store.activeTrial.crosses).toHaveLength(1);
  });

  it("restores a present-but-empty trial 'A' without error (navigated-but-never-interacted)", () => {
    const empty: TrialState = { p1: null, p2: null, locked: false, fungusOn: false, crosses: [] };
    const store = hydrate({ trials: { A: empty }, selectedTrialLetter: "A" });
    expect(store.trialLetters).toEqual(["A"]);
    expect(store.activeTrial.canReset).toBe(false);
  });

  it("restores ≥ 2 trials with the saved active letter", () => {
    const trialA: TrialState = { p1: W1, p2: C1, locked: true, fungusOn: false, crosses: [CROSS] };
    const trialB: TrialState = { p1: C1, p2: null, locked: false, fungusOn: false, crosses: [] };
    const store = hydrate({ trials: { A: trialA, B: trialB }, selectedTrialLetter: "B" });
    expect(store.trialLetters).toEqual(["A", "B"]);
    expect(store.ui.selectedTrialLetter).toBe("B");
    expect(store.activeTrial.p1).toBe(C1); // B is active
    expect(store.trials.get("A")?.crosses).toHaveLength(1);
  });
});
