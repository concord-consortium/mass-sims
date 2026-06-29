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

const INPUT: SimInput = { walkerCount: 50, stepSize: 1, framesPerTrial: 200, seed: "s" };
const OUTPUT: SimOutput = { avgDistance: 12.3, stdDevDistance: 2.1, avgDistanceSeries: [1, 2, 3] };

describe("migrateSavedState — current versioned shape", () => {
  it("passes a valid versioned state through unchanged", () => {
    const state: SavedState = {
      version: 1,
      trials: { A: { input: INPUT, output: OUTPUT, finalTransient: null } },
      selectedTrialLetter: "A",
    };
    expect(migrateSavedState(state)).toEqual(state);
  });

  it("returns null for a versioned state with no trials", () => {
    expect(migrateSavedState({ version: 1, trials: {}, selectedTrialLetter: "A" })).toBeNull();
  });

  it("returns null for a versioned state missing selectedTrialLetter", () => {
    expect(migrateSavedState({ version: 1, trials: { A: {} } })).toBeNull();
  });
});

describe("migrateSavedState — rejects payloads that can't hydrate cleanly", () => {
  const trial = { input: INPUT, output: OUTPUT, finalTransient: null };

  it("rejects a selected letter outside A–J (would throw the enumeration on hydrate)", () => {
    expect(
      migrateSavedState({ version: 1, trials: { A: trial }, selectedTrialLetter: "Z" }),
    ).toBeNull();
  });

  it("rejects when the selected letter names no present trial", () => {
    expect(
      migrateSavedState({ version: 1, trials: { A: trial }, selectedTrialLetter: "B" }),
    ).toBeNull();
  });

  it("rejects a trial keyed by a non-letter", () => {
    expect(
      migrateSavedState({ version: 1, trials: { A: trial, foo: trial }, selectedTrialLetter: "A" }),
    ).toBeNull();
  });

  it("rejects a trial missing its required input", () => {
    expect(
      migrateSavedState({
        version: 1,
        trials: { A: { output: null, finalTransient: null } },
        selectedTrialLetter: "A",
      }),
    ).toBeNull();
  });

  it("rejects a trial whose output is malformed (non-object, non-null)", () => {
    expect(
      migrateSavedState({
        version: 1,
        trials: { A: { input: INPUT, output: "garbage" } },
        selectedTrialLetter: "A",
      }),
    ).toBeNull();
  });
});

describe("migrateSavedState — malformed / unknown input", () => {
  it.each([
    null,
    undefined,
    42,
    "nope",
    {},
    { version: 2 },
    { foo: "bar" },
  ])("returns null for %o", (raw) => {
    expect(migrateSavedState(raw)).toBeNull();
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
    expect(state.trials.A?.output).toEqual(OUTPUT);
  });

  it("a validated state hydrates a store via the { trials, ui } projection", () => {
    const saved: SavedState = {
      version: 1,
      trials: {
        A: { input: INPUT, output: OUTPUT, finalTransient: null },
        B: { input: { ...INPUT, seed: "b" }, output: null, finalTransient: null },
      },
      selectedTrialLetter: "B",
    };
    const migrated = migrateSavedState(saved);
    expect(migrated).not.toBeNull();
    const store = createRootStore();
    if (migrated) {
      applySnapshot(store, {
        trials: migrated.trials,
        ui: { selectedTrialLetter: migrated.selectedTrialLetter },
      });
    }
    expect(store.trialLetters).toEqual(["A", "B"]);
    expect(store.ui.selectedTrialLetter).toBe("B");
    expect(store.trials.get("A")?.output).toEqual(OUTPUT);
  });

  it("round-trips a persisted state back through migrate + hydrate unchanged", () => {
    const store = createRootStore();
    store.addTrial(); // B
    store.activeTrial.setOutput(OUTPUT, {
      frame: 200,
      walkers: [{ x: 2, y: 2 }],
      avgDistanceSeries: [4, 5, 6],
    });
    const saved = toSavedState(getSnapshot(store));
    const migrated = migrateSavedState(saved);

    const restored = createRootStore();
    if (migrated) {
      applySnapshot(restored, {
        trials: migrated.trials,
        ui: { selectedTrialLetter: migrated.selectedTrialLetter },
      });
    }
    expect(toSavedState(getSnapshot(restored))).toEqual(saved);
  });
});
