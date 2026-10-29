import { applySnapshot, getSnapshot } from "mobx-state-tree";
import { describe, expect, it } from "vitest";
import { createRootStore } from "./root-store";
import {
  migrateSavedState,
  SAVED_STATE_VERSION,
  type SavedState,
  toSavedState,
} from "./saved-state";

const TRIAL = {
  samples: [
    { id: 1, years: 200000, rate: 29.4, roof: 8800 },
    { id: 3, years: 0, rate: 31.2, roof: 2800 },
  ],
  nextSampleId: 4,
};

/** A trial told apart by its rate, so a test can tell which saved trial landed under which letter. */
const trialWithRate = (rate: number) => ({
  samples: [{ id: 1, years: 100000, rate, roof: 5800 }],
  nextSampleId: 2,
});

function migrate(raw: unknown): SavedState {
  const state = migrateSavedState(raw);
  if (!state) throw new Error("expected a migrated state");
  return state;
}

/** Whether a migrated trial is a fresh empty one. */
function isEmpty(trial: SavedState["trials"]["A"]): boolean {
  return trial.samples.length === 0 && trial.nextSampleId === 1;
}

describe("migrateSavedState — normalizes to exactly A–D", () => {
  it("passes a state with four valid trials through unchanged", () => {
    const state: SavedState = {
      version: 2,
      trials: {
        A: trialWithRate(1),
        B: trialWithRate(2),
        C: trialWithRate(3),
        D: trialWithRate(4),
      },
      selectedTrialLetter: "C",
    };
    expect(migrate(state)).toEqual(state);
  });

  it("a B-only save → A, B, C, D in that order, B intact, A/C/D empty", () => {
    const state = migrate({ version: 2, trials: { B: TRIAL }, selectedTrialLetter: "B" });
    expect(Object.keys(state.trials)).toEqual(["A", "B", "C", "D"]);
    expect(state.trials.B).toEqual(TRIAL);
    expect(isEmpty(state.trials.A)).toBe(true);
    expect(isEmpty(state.trials.C)).toBe(true);
    expect(isEmpty(state.trials.D)).toBe(true);
    expect(state.selectedTrialLetter).toBe("B");
  });

  it("a save with A–D plus an E → E ignored, four trials in A–D order, A–D data preserved", () => {
    // Out of order, so the result's A–D key order must come from the function, and distinct trials,
    // so each must land under its own letter.
    const trials = {
      E: trialWithRate(5),
      D: trialWithRate(4),
      C: trialWithRate(3),
      B: trialWithRate(2),
      A: trialWithRate(1),
    };
    const state = migrate({ version: 2, trials, selectedTrialLetter: "A" });
    expect(Object.keys(state.trials)).toEqual(["A", "B", "C", "D"]);
    expect(state.trials).toEqual({
      A: trialWithRate(1),
      B: trialWithRate(2),
      C: trialWithRate(3),
      D: trialWithRate(4),
    });
  });

  it('selectedTrialLetter "E" → "A"', () => {
    const state = migrate({ version: 2, trials: { A: TRIAL }, selectedTrialLetter: "E" });
    expect(state.selectedTrialLetter).toBe("A");
  });

  it('a missing or non-string selectedTrialLetter → "A"', () => {
    expect(migrate({ version: 2, trials: { A: TRIAL } }).selectedTrialLetter).toBe("A");
    expect(
      migrate({ version: 2, trials: { A: TRIAL }, selectedTrialLetter: 3 }).selectedTrialLetter,
    ).toBe("A");
  });

  it("one malformed C entry → C empty, A/B/D intact", () => {
    const trials = { A: TRIAL, B: TRIAL, C: { samples: "nope" }, D: TRIAL };
    const state = migrate({ version: 2, trials, selectedTrialLetter: "A" });
    expect(isEmpty(state.trials.C)).toBe(true);
    expect(state.trials.A).toEqual(TRIAL);
    expect(state.trials.B).toEqual(TRIAL);
    expect(state.trials.D).toEqual(TRIAL);
  });

  it("empty trials → four empty trials", () => {
    const state = migrate({ version: 2, trials: {}, selectedTrialLetter: "A" });
    expect(Object.keys(state.trials)).toEqual(["A", "B", "C", "D"]);
    for (const trial of Object.values(state.trials)) expect(isEmpty(trial)).toBe(true);
  });
});

describe("migrateSavedState — replaces trials that can't hydrate cleanly", () => {
  const replaced = (A: unknown) =>
    isEmpty(migrate({ version: 2, trials: { A }, selectedTrialLetter: "A" }).trials.A);
  const sample = TRIAL.samples[0];

  it("keeps a valid trial, including one with no samples", () => {
    expect(replaced(TRIAL)).toBe(false);
    expect(migrate({ version: 2, trials: { A: TRIAL } }).trials.A).toEqual(TRIAL);
    expect(replaced({ samples: [], nextSampleId: 7 })).toBe(false);
  });

  it("replaces a trial missing its samples or its counter", () => {
    expect(replaced({ nextSampleId: 1 })).toBe(true);
    expect(replaced({ samples: [] })).toBe(true);
    expect(replaced({ samples: [], nextSampleId: "1" })).toBe(true);
  });

  it("replaces a trial with a bad sample", () => {
    const bad = (patch: object) => ({ samples: [{ ...sample, ...patch }], nextSampleId: 9 });
    expect(replaced(bad({ rate: "29" }))).toBe(true);
    expect(replaced(bad({ roof: Number.NaN }))).toBe(true);
    expect(replaced(bad({ id: undefined }))).toBe(true);
    // A year the timeline can't land on.
    expect(replaced(bad({ years: 12345 }))).toBe(true);
    expect(replaced({ samples: [null], nextSampleId: 9 })).toBe(true);
  });

  it("replaces a trial with duplicate ids", () => {
    expect(replaced({ samples: [sample, { ...sample, years: 0 }], nextSampleId: 9 })).toBe(true);
  });

  it("replaces a trial whose counter is not above every id", () => {
    expect(replaced({ samples: [{ ...sample, id: 3 }], nextSampleId: 3 })).toBe(true);
    expect(replaced({ samples: [{ ...sample, id: 3 }], nextSampleId: 2 })).toBe(true);
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
    { version: 3 },
    { version: 2 },
    { version: 2, trials: [] },
    { version: 2, trials: "nope" },
  ])("returns null for %o", (raw) => {
    expect(migrateSavedState(raw)).toBeNull();
  });

  it("drops a version-1 (random-walk placeholder) payload", () => {
    const v1Trial = {
      input: { walkerCount: 50, stepSize: 1, framesPerTrial: 200, seed: "s" },
      output: null,
      finalTransient: null,
    };
    expect(
      migrateSavedState({ version: 1, trials: { A: v1Trial }, selectedTrialLetter: "A" }),
    ).toBeNull();
  });
});

describe("toSavedState + hydrate round-trip", () => {
  it("projects a snapshot to the flat versioned envelope", () => {
    const store = createRootStore();
    const sample = store.takeSample();
    const state = toSavedState(getSnapshot(store));
    expect(state.version).toBe(SAVED_STATE_VERSION);
    expect(SAVED_STATE_VERSION).toBe(2);
    expect(state.selectedTrialLetter).toBe("A");
    expect(state.trials.A).toEqual({ samples: [sample], nextSampleId: 2 });
  });

  it("changes the saved state when a sample is taken or deleted", () => {
    const store = createRootStore();
    const before = JSON.stringify(toSavedState(getSnapshot(store)));
    const sample = store.takeSample();
    const afterTake = JSON.stringify(toSavedState(getSnapshot(store)));
    expect(afterTake).not.toBe(before);
    store.deleteSample("A", sample.id);
    expect(JSON.stringify(toSavedState(getSnapshot(store)))).not.toBe(afterTake);
  });

  it("leaves the saved state unchanged when the timeline value, selection, or sort changes", () => {
    // The app skips a save whose serialized payload matches the last one, so an unchanged
    // projection means these changes send nothing.
    const store = createRootStore();
    store.takeSample();
    const before = JSON.stringify(toSavedState(getSnapshot(store)));
    store.ui.setTimelineIndex(5);
    expect(store.ui.timelineIndex).toBe(5);
    store.ui.selectSample("A", null);
    store.ui.cycleSort("rate");
    expect(JSON.stringify(toSavedState(getSnapshot(store)))).toBe(before);
  });

  it("a normalized B-only save hydrates a store to four trials in A–D order", () => {
    const migrated = migrate({ version: 2, trials: { B: TRIAL }, selectedTrialLetter: "B" });
    const store = createRootStore();
    applySnapshot(store, {
      trials: migrated.trials,
      ui: { selectedTrialLetter: migrated.selectedTrialLetter },
    });
    expect(store.trialLetters).toEqual(["A", "B", "C", "D"]);
    expect(store.ui.selectedTrialLetter).toBe("B");
    expect(store.trials.get("B")?.samples).toEqual(TRIAL.samples);
    // The restored counter keeps new ids clear of the restored ones.
    expect(store.takeSample().id).toBe(4);
  });

  it("round-trips a persisted state back through migrate + hydrate unchanged", () => {
    const store = createRootStore();
    store.ui.selectTrial("B");
    store.takeSample();
    store.takeSample();
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
