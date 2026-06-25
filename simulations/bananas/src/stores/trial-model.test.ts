import { seededRandom } from "@concord-consortium/mass-sims-shared";
import { getSnapshot } from "mobx-state-tree";
import { describe, expect, it } from "vitest";
import type { ParentId } from "../model/genetics";
import { emptyTrialSnapshot, TrialModel } from "./trial-model";

const W1: ParentId = "wild-w1";
const W2: ParentId = "wild-w2";
const C1: ParentId = "cavendish-c1";

/** Construct a TrialModel with the rng injected as MST environment, like the real root store. */
function makeTrial(rng: () => number = seededRandom("trial-model")) {
  return TrialModel.create(emptyTrialSnapshot(), { rng });
}

describe("emptyTrialSnapshot", () => {
  it("returns the empty trial shape and a fresh crosses array each call", () => {
    const a = emptyTrialSnapshot();
    const b = emptyTrialSnapshot();
    expect(a).toEqual({ p1: null, p2: null, locked: false, fungusOn: false, crosses: [] });
    expect(a.crosses).not.toBe(b.crosses);
  });
});

describe("TrialModel views", () => {
  it("computes derived state for the empty trial", () => {
    const trial = makeTrial();
    expect(trial.bothParentsSelected).toBe(false);
    expect(trial.atCrossCap).toBe(false);
    expect(trial.canCross).toBe(false);
    expect(trial.isFungusLocked).toBe(true); // locked while parents incomplete
    expect(trial.canReset).toBe(false);
    expect(trial.totalOffspring).toBe(0);
  });

  it("enables cross and unlocks fungus once both parents are selected", () => {
    const trial = makeTrial();
    trial.setP1(W1);
    trial.setP2(C1);
    expect(trial.bothParentsSelected).toBe(true);
    expect(trial.canCross).toBe(true);
    expect(trial.isFungusLocked).toBe(false);
    expect(trial.canReset).toBe(true);
  });
});

describe("TrialModel.setP1 / setP2", () => {
  it("sets the parents when not locked", () => {
    const trial = makeTrial();
    trial.setP1(W1);
    trial.setP2(C1);
    expect(trial.p1).toBe(W1);
    expect(trial.p2).toBe(C1);
  });

  it("no-ops once the trial is locked (after a cross)", () => {
    const trial = makeTrial();
    trial.setP1(W1);
    trial.setP2(C1);
    trial.crossPlants();
    expect(trial.locked).toBe(true);
    trial.setP1(W2);
    trial.setP2(W2);
    expect(trial.p1).toBe(W1); // unchanged
    expect(trial.p2).toBe(C1); // unchanged
  });
});

describe("TrialModel.setFungus", () => {
  it("toggles fungus when both parents are selected and no cross exists", () => {
    const trial = makeTrial();
    trial.setP1(W1);
    trial.setP2(C1);
    trial.setFungus(true);
    expect(trial.fungusOn).toBe(true);
    trial.setFungus(false);
    expect(trial.fungusOn).toBe(false);
  });

  it("no-ops when parents are not both selected", () => {
    const trial = makeTrial();
    trial.setP1(W1);
    trial.setFungus(true);
    expect(trial.fungusOn).toBe(false);
  });

  it("no-ops once a cross exists", () => {
    const trial = makeTrial();
    trial.setP1(W1);
    trial.setP2(C1);
    trial.crossPlants();
    trial.setFungus(true);
    expect(trial.fungusOn).toBe(false);
  });
});

describe("TrialModel.crossPlants", () => {
  it("appends a cross and locks the trial", () => {
    const trial = makeTrial();
    trial.setP1(W1);
    trial.setP2(C1);
    trial.crossPlants();
    expect(trial.crosses.length).toBe(1);
    expect(trial.locked).toBe(true);
    expect(trial.totalOffspring).toBe(trial.crosses[0].length);
    expect(trial.crosses[0].length).toBeGreaterThan(0);
  });

  it("no-ops without both parents", () => {
    const trial = makeTrial();
    trial.setP1(W1);
    trial.crossPlants();
    expect(trial.crosses.length).toBe(0);
    expect(trial.locked).toBe(false);
  });

  it("stops appending at the cross cap (MAX_CROSSES)", () => {
    const trial = makeTrial();
    trial.setP1(W1);
    trial.setP2(C1);
    for (let i = 0; i < 10; i++) trial.crossPlants();
    expect(trial.crosses.length).toBe(6);
    expect(trial.atCrossCap).toBe(true);
    expect(trial.canCross).toBe(false);
  });

  it("respects fungusOn — infected offspring appear only when fungus is active", () => {
    const trial = makeTrial(seededRandom("fungus-cross"));
    trial.setP1(C1); // rr x rr → all non-resistant
    trial.setP2(C1);
    trial.setFungus(true);
    trial.crossPlants();
    const infectedCount = trial.crosses[0].filter((p) => p.infected).length;
    expect(infectedCount).toBeGreaterThan(0); // non-resistant + fungus → infected
  });
});

describe("TrialModel.reset", () => {
  it("returns the trial to the empty snapshot shape", () => {
    const trial = makeTrial();
    trial.setP1(W1);
    trial.setP2(C1);
    trial.setFungus(true);
    trial.crossPlants();
    trial.reset();
    expect(getSnapshot(trial)).toEqual({
      p1: null,
      p2: null,
      locked: false,
      fungusOn: false,
      crosses: [],
    });
    expect(trial.canReset).toBe(false);
  });
});

describe("TrialModel snapshot shape", () => {
  it("matches the TrialState wire format field-for-field", () => {
    const trial = makeTrial();
    trial.setP1(W1);
    trial.setP2(C1);
    trial.crossPlants();
    const snap = getSnapshot(trial);
    expect(Object.keys(snap).sort()).toEqual(["crosses", "fungusOn", "locked", "p1", "p2"].sort());
    const plant = snap.crosses[0][0];
    expect(Object.keys(plant).sort()).toEqual(["genotype", "infected", "isResistant"].sort());
  });
});
