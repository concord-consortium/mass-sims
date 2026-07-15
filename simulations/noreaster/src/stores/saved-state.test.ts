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

const INPUT: SimInput = { seed: "s" };
const OUTPUT: SimOutput = {};

describe("migrateSavedState — current versioned shape", () => {
  it("passes a valid versioned state through unchanged", () => {
    const state: SavedState = {
      version: 1,
      trials: { A: { input: INPUT, output: OUTPUT } },
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
  const trial = { input: INPUT, output: OUTPUT };

  it("rejects a selected letter outside A–J (would throw the enumeration on hydrate)", () => {
    expect(
      migrateSavedState({ version: 1, trials: { A: trial }, selectedTrialLetter: "Z" }),
    ).toBeNull();
  });

  it("accepts a valid-but-absent selected letter (App's reaction re-selects; trials preserved)", () => {
    const state = { version: 1, trials: { A: trial }, selectedTrialLetter: "B" };
    expect(migrateSavedState(state)).toEqual(state);
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
        trials: { A: { output: null } },
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

  it("rejects a trial whose input is missing its seed or has the wrong seed type", () => {
    const cases = [
      {}, // no seed
      { seed: 123 }, // wrong type
    ];
    for (const input of cases) {
      expect(
        migrateSavedState({ version: 1, trials: { A: { input } }, selectedTrialLetter: "A" }),
      ).toBeNull();
    }
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
    store.activeTrial.setOutput(OUTPUT);
    const state = toSavedState(getSnapshot(store));
    expect(state.version).toBe(SAVED_STATE_VERSION);
    expect(state.selectedTrialLetter).toBe("A");
    expect(state.trials.A?.output).toEqual(OUTPUT);
  });

  it("a validated state hydrates a store via the { trials, ui } projection", () => {
    const saved: SavedState = {
      version: 1,
      trials: {
        A: { input: INPUT, output: OUTPUT },
        B: { input: { seed: "b" }, output: null },
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
    store.activeTrial.setOutput(OUTPUT);
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
