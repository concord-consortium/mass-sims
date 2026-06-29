import { type Instance, types } from "mobx-state-tree";
import { describe, expect, it } from "vitest";
import { activeTrial, addTrial, canAddTrial, hasAnyProgress, trialLetters } from "./stores";
import { UiStore } from "./ui-store";

/**
 * A minimal stand-in for a sim's `TrialModel` with a configurable "is progress" flag — exercises the
 * generic helpers against a real MST map without coupling to any sim's domain shape. This doubles as
 * a typing check: if the helpers compose cleanly here, they compose for the real sims.
 */
const FakeTrial = types
  .model("FakeTrial", { dirty: types.optional(types.boolean, false) })
  .actions((self) => ({
    markDirty() {
      self.dirty = true;
    },
  }));
type FakeTrialInstance = Instance<typeof FakeTrial>;

const FakeRoot = types
  .model("FakeRoot", {
    trials: types.map(FakeTrial),
    ui: UiStore,
  })
  .actions((self) => ({
    add(): string | null {
      return addTrial(self.trials, () => FakeTrial.create({}));
    },
  }))
  .views((self) => ({
    get active(): FakeTrialInstance {
      return activeTrial(self.trials, self.ui.selectedTrialLetter);
    },
    get canAdd(): boolean {
      return canAddTrial(self.trials);
    },
    get letters(): readonly string[] {
      return trialLetters(self.trials);
    },
    get anyProgress(): boolean {
      return hasAnyProgress(self.trials, (trial) => trial.dirty);
    },
  }));

function makeRoot() {
  return FakeRoot.create({ trials: { A: {} }, ui: { selectedTrialLetter: "A" } });
}

describe("addTrial", () => {
  it("appends the next free letter from a single-trial start", () => {
    const root = makeRoot();
    expect(root.add()).toBe("B");
    expect(root.letters).toEqual(["A", "B"]);
  });

  it("find-first-missing: fills a gap rather than appending past it", () => {
    const root = FakeRoot.create({ trials: { A: {}, C: {} }, ui: { selectedTrialLetter: "A" } });
    expect(root.add()).toBe("B");
    expect(root.letters).toEqual(["A", "C", "B"]);
  });

  it("returns null at the cap and does not grow the map", () => {
    const root = makeRoot();
    while (root.canAdd) root.add();
    expect(root.letters).toHaveLength(10);
    expect(root.add()).toBeNull();
    expect(root.letters).toHaveLength(10);
  });
});

describe("canAddTrial / trialLetters", () => {
  it("canAddTrial is true below the cap and false at it", () => {
    const root = makeRoot();
    expect(root.canAdd).toBe(true);
    while (root.canAdd) root.add();
    expect(root.canAdd).toBe(false);
  });
});

describe("activeTrial", () => {
  it("returns the selected trial when present", () => {
    const root = makeRoot();
    root.add(); // B
    root.ui.selectTrial("B");
    expect(root.active).toBe(root.trials.get("B"));
  });

  it("falls back to the first trial when the selected letter is absent", () => {
    const root = makeRoot();
    // "C" is a valid A–J letter but not in the map → fall back to the first (A).
    root.ui.selectTrial("C");
    expect(root.active).toBe(root.trials.get("A"));
  });

  it("throws only when there are genuinely no trials", () => {
    const empty = FakeRoot.create({ trials: {}, ui: { selectedTrialLetter: "A" } });
    expect(() => empty.active).toThrow(/invariant/);
  });
});

describe("hasAnyProgress", () => {
  it("is false when no trial reports progress", () => {
    const root = makeRoot();
    root.add();
    expect(root.anyProgress).toBe(false);
  });

  it("is true when any trial (not just the active one) reports progress via the predicate", () => {
    const root = makeRoot();
    root.add(); // B
    root.trials.get("B")?.markDirty();
    // A is active and clean; B is dirty → predicate sees progress across the whole map.
    expect(root.ui.selectedTrialLetter).toBe("A");
    expect(root.anyProgress).toBe(true);
  });
});
