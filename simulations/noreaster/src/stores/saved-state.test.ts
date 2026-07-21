import { applySnapshot, getSnapshot } from "mobx-state-tree";
import { describe, expect, it } from "vitest";
import { createRootStore } from "./root-store";
import {
  migrateSavedState,
  SAVED_STATE_VERSION,
  type SavedState,
  toSavedState,
} from "./saved-state";
import { runStrong, STRONG_SETUP } from "./test-helpers";

/** A full persisted trial object (all six keys), defaulting to unconfigured; override as needed. */
function trial(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    landPathway: null,
    landHumidity: null,
    landTemperature: null,
    oceanPathway: null,
    oceanHumidity: null,
    outcome: null,
    ...overrides,
  };
}

describe("migrateSavedState — current versioned shape", () => {
  it("passes a valid versioned state through unchanged (configured + run trial)", () => {
    const state = {
      version: 1,
      trials: { A: trial({ ...STRONG_SETUP, outcome: "strong" }) },
      selectedTrialLetter: "A",
    };
    expect(migrateSavedState(state)).toEqual(state);
  });

  it("accepts an unconfigured trial (all fields null)", () => {
    const state = { version: 1, trials: { A: trial() }, selectedTrialLetter: "A" };
    expect(migrateSavedState(state)).toEqual(state);
  });

  it("returns null for a versioned state with no trials", () => {
    expect(migrateSavedState({ version: 1, trials: {}, selectedTrialLetter: "A" })).toBeNull();
  });

  it("returns null for a versioned state missing selectedTrialLetter", () => {
    expect(migrateSavedState({ version: 1, trials: { A: trial() } })).toBeNull();
  });
});

describe("migrateSavedState — rejects payloads that can't hydrate cleanly", () => {
  it("rejects a selected letter outside A–J (would throw the enumeration on hydrate)", () => {
    expect(
      migrateSavedState({ version: 1, trials: { A: trial() }, selectedTrialLetter: "Z" }),
    ).toBeNull();
  });

  it("accepts a valid-but-absent selected letter (App's reaction re-selects; trials preserved)", () => {
    const state = { version: 1, trials: { A: trial() }, selectedTrialLetter: "B" };
    expect(migrateSavedState(state)).toEqual(state);
  });

  it("rejects a trial keyed by a non-letter", () => {
    expect(
      migrateSavedState({
        version: 1,
        trials: { A: trial(), foo: trial() },
        selectedTrialLetter: "A",
      }),
    ).toBeNull();
  });

  it("rejects the old seed-only trial shape", () => {
    expect(
      migrateSavedState({
        version: 1,
        trials: { A: { input: { seed: "s" }, output: {} } },
        selectedTrialLetter: "A",
      }),
    ).toBeNull();
  });

  it("rejects an out-of-range enum value", () => {
    expect(
      migrateSavedState({
        version: 1,
        trials: { A: trial({ landPathway: "SOUTH" }) },
        selectedTrialLetter: "A",
      }),
    ).toBeNull();
  });

  it("rejects a trial with an extra key", () => {
    expect(
      migrateSavedState({
        version: 1,
        trials: { A: trial({ ...STRONG_SETUP, outcome: "strong", extra: 1 }) },
        selectedTrialLetter: "A",
      }),
    ).toBeNull();
  });

  it("rejects a trial missing a key", () => {
    const { outcome, ...missingOutcome } = trial();
    void outcome;
    expect(
      migrateSavedState({ version: 1, trials: { A: missingOutcome }, selectedTrialLetter: "A" }),
    ).toBeNull();
  });

  it("rejects an outcome recorded on an incomplete setup", () => {
    expect(
      migrateSavedState({
        version: 1,
        trials: { A: trial({ landPathway: "N/NW", outcome: "strong" }) },
        selectedTrialLetter: "A",
      }),
    ).toBeNull();
  });

  it("preserves a historically recorded outcome (does NOT recompute it)", () => {
    // This complete setup evaluates to "strong" today, but the persisted outcome is "fair" — a value
    // a future (MAS-39) mapping might have produced. It must survive migration unchanged.
    const state = {
      version: 1,
      trials: { A: trial({ ...STRONG_SETUP, outcome: "fair" }) },
      selectedTrialLetter: "A",
    };
    const migrated = migrateSavedState(state);
    expect(migrated?.trials.A?.outcome).toBe("fair");
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
    runStrong(store.activeTrial);
    const state = toSavedState(getSnapshot(store));
    expect(state.version).toBe(SAVED_STATE_VERSION);
    expect(state.selectedTrialLetter).toBe("A");
    expect(state.trials.A?.outcome).toBe("strong");
  });

  it("round-trips a persisted state back through migrate + hydrate unchanged", () => {
    const store = createRootStore();
    store.addTrial(); // B
    runStrong(store.activeTrial); // A → strong
    store.trials.get("B")?.setOceanPathway("NE"); // B → partial (no outcome)
    const saved = toSavedState(getSnapshot(store));
    const migrated = migrateSavedState(saved);
    expect(migrated).not.toBeNull();

    const restored = createRootStore();
    if (migrated) {
      applySnapshot(restored, {
        trials: migrated.trials as SavedState["trials"],
        ui: { selectedTrialLetter: migrated.selectedTrialLetter },
      });
    }
    expect(toSavedState(getSnapshot(restored))).toEqual(saved);
    // The recorded lock state survives the round-trip.
    expect(restored.trials.get("A")?.locked).toBe(true);
    expect(restored.trials.get("B")?.locked).toBe(false);
  });
});
