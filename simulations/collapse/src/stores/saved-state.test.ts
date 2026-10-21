import { seededRandom } from "@concord-consortium/mass-sims-shared";
import { applySnapshot, getSnapshot } from "mobx-state-tree";
import { describe, expect, it } from "vitest";
import type { SimInput, SimOutput } from "../model/types";
import { createRootStore } from "./root-store";
import {
  migrateSavedState,
  SAVED_STATE_VERSION,
  type SavedState,
  toSavedState,
} from "./saved-state";
import { DEFAULT_PARAMS } from "./trial-model";

const INPUT: SimInput = { walkerCount: 50, stepSize: 1, framesPerTrial: 200, seed: "s" };
const OUTPUT: SimOutput = { avgDistance: 12.3, stdDevDistance: 2.1, avgDistanceSeries: [1, 2, 3] };
const TRIAL = { input: INPUT, output: OUTPUT, finalTransient: null };

const rng = seededRandom("saved-state-test");

/** Migrate, asserting a non-null result. */
function migrate(raw: unknown): SavedState {
  const state = migrateSavedState(raw, rng);
  if (!state) throw new Error("expected a migrated state");
  return state;
}

/** Whether a migrated trial is a fresh empty one (default params, nothing recorded). */
function isEmpty(trial: SavedState["trials"]["A"]): boolean {
  const { seed: _seed, ...params } = trial.input;
  return (
    trial.output === null &&
    trial.finalTransient === null &&
    JSON.stringify(params) === JSON.stringify(DEFAULT_PARAMS)
  );
}

describe("migrateSavedState — normalizes to exactly A–D", () => {
  it("passes a state with four valid trials through unchanged", () => {
    const state: SavedState = {
      version: 1,
      trials: { A: TRIAL, B: TRIAL, C: TRIAL, D: TRIAL },
      selectedTrialLetter: "C",
    };
    expect(migrate(state)).toEqual(state);
  });

  it("a B-only save → A, B, C, D in that order, B intact, A/C/D empty", () => {
    const state = migrate({ version: 1, trials: { B: TRIAL }, selectedTrialLetter: "B" });
    expect(Object.keys(state.trials)).toEqual(["A", "B", "C", "D"]);
    expect(state.trials.B).toEqual(TRIAL);
    expect(isEmpty(state.trials.A)).toBe(true);
    expect(isEmpty(state.trials.C)).toBe(true);
    expect(isEmpty(state.trials.D)).toBe(true);
    expect(state.selectedTrialLetter).toBe("B");
  });

  it("a save with A–D plus an E → E ignored, four trials, A–D data preserved", () => {
    const trials = { A: TRIAL, B: TRIAL, C: TRIAL, D: TRIAL, E: TRIAL };
    const state = migrate({ version: 1, trials, selectedTrialLetter: "A" });
    expect(state.trials).toEqual({ A: TRIAL, B: TRIAL, C: TRIAL, D: TRIAL });
  });

  it('selectedTrialLetter "E" → "A"', () => {
    const state = migrate({ version: 1, trials: { A: TRIAL }, selectedTrialLetter: "E" });
    expect(state.selectedTrialLetter).toBe("A");
  });

  it('a missing or non-string selectedTrialLetter → "A"', () => {
    expect(migrate({ version: 1, trials: { A: TRIAL } }).selectedTrialLetter).toBe("A");
    expect(
      migrate({ version: 1, trials: { A: TRIAL }, selectedTrialLetter: 3 }).selectedTrialLetter,
    ).toBe("A");
  });

  it("one malformed C entry → C empty, A/B/D intact", () => {
    const trials = { A: TRIAL, B: TRIAL, C: { input: {} }, D: TRIAL };
    const state = migrate({ version: 1, trials, selectedTrialLetter: "A" });
    expect(isEmpty(state.trials.C)).toBe(true);
    expect(state.trials.A).toEqual(TRIAL);
    expect(state.trials.B).toEqual(TRIAL);
    expect(state.trials.D).toEqual(TRIAL);
  });

  it("empty trials → four empty trials with distinct seeds", () => {
    const state = migrate({ version: 1, trials: {}, selectedTrialLetter: "A" });
    expect(Object.keys(state.trials)).toEqual(["A", "B", "C", "D"]);
    for (const trial of Object.values(state.trials)) expect(isEmpty(trial)).toBe(true);
    expect(new Set(Object.values(state.trials).map((t) => t.input.seed)).size).toBe(4);
  });
});

describe("migrateSavedState — replaces trials that can't hydrate cleanly", () => {
  const replaced = (A: unknown) =>
    isEmpty(migrate({ version: 1, trials: { A }, selectedTrialLetter: "A" }).trials.A);

  it("replaces a trial missing its required input", () => {
    expect(replaced({ output: null, finalTransient: null })).toBe(true);
  });

  it("replaces a trial whose output is malformed (non-object, non-null)", () => {
    expect(replaced({ input: INPUT, output: "garbage" })).toBe(true);
  });

  it("replaces a trial whose input fields are missing or wrong-typed", () => {
    expect(replaced({ input: {} })).toBe(true);
    expect(replaced({ input: { walkerCount: 50, stepSize: 1, framesPerTrial: 200 } })).toBe(true);
    expect(
      replaced({ input: { walkerCount: "50", stepSize: 1, framesPerTrial: 200, seed: "x" } }),
    ).toBe(true);
  });

  it("replaces non-positive run parameters (zero walkers / a run that never completes)", () => {
    expect(replaced({ input: { ...INPUT, walkerCount: 0 } })).toBe(true);
    expect(replaced({ input: { ...INPUT, framesPerTrial: 0 } })).toBe(true);
  });

  it("replaces malformed output / finalTransient inner shapes", () => {
    expect(
      replaced({
        input: INPUT,
        output: { avgDistance: "x", stdDevDistance: 1, avgDistanceSeries: [] },
      }),
    ).toBe(true);
    // walker missing `y`
    expect(
      replaced({
        input: INPUT,
        finalTransient: { frame: 1, walkers: [{ x: 1 }], avgDistanceSeries: [] },
      }),
    ).toBe(true);
  });
});

describe("migrateSavedState — unrecognized input", () => {
  it.each([
    null,
    undefined,
    42,
    "nope",
    [],
    {},
    { version: 2 },
    { foo: "bar" },
    { version: 1 },
    { version: 1, trials: [] },
    { version: 1, trials: "nope" },
  ])("returns null for %o", (raw) => {
    expect(migrateSavedState(raw, rng)).toBeNull();
  });
});

describe("toSavedState + hydrate round-trip", () => {
  it("projects a snapshot to the flat versioned envelope", () => {
    const store = createRootStore();
    store.activeTrial.setOutput(OUTPUT, {
      frame: 200,
      walkers: [{ x: 1, y: 1 }],
      avgDistanceSeries: [1, 2, 3],
    });
    const state = toSavedState(getSnapshot(store));
    expect(state.version).toBe(SAVED_STATE_VERSION);
    expect(state.selectedTrialLetter).toBe("A");
    expect(state.trials.A.output).toEqual(OUTPUT);
  });

  it("a normalized B-only save hydrates a store to four trials in A–D order", () => {
    const migrated = migrate({ version: 1, trials: { B: TRIAL }, selectedTrialLetter: "B" });
    const store = createRootStore();
    applySnapshot(store, {
      trials: migrated.trials,
      ui: { selectedTrialLetter: migrated.selectedTrialLetter },
    });
    expect(store.trialLetters).toEqual(["A", "B", "C", "D"]);
    expect(store.ui.selectedTrialLetter).toBe("B");
    expect(store.trials.get("B")?.output).toEqual(OUTPUT);
  });

  it("round-trips a persisted state back through migrate + hydrate unchanged", () => {
    const store = createRootStore();
    store.ui.selectTrial("B");
    store.activeTrial.setOutput(OUTPUT, {
      frame: 200,
      walkers: [{ x: 2, y: 2 }],
      avgDistanceSeries: [4, 5, 6],
    });
    const saved = toSavedState(getSnapshot(store));
    const migrated = migrate(saved);

    const restored = createRootStore();
    applySnapshot(restored, {
      trials: migrated.trials,
      ui: { selectedTrialLetter: migrated.selectedTrialLetter },
    });
    expect(toSavedState(getSnapshot(restored))).toEqual(saved);
  });
});
