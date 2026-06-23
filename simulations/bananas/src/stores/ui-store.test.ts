import { getSnapshot } from "mobx-state-tree";
import { describe, expect, it } from "vitest";
import { UiStore } from "./ui-store";

describe("UiStore", () => {
  it("defaults to trial 'A' with no cross selections", () => {
    const ui = UiStore.create({});
    expect(ui.selectedTrialLetter).toBe("A");
    expect(ui.selectedCrossByTrial.size).toBe(0);
  });

  it("selectTrial updates the active letter", () => {
    const ui = UiStore.create({});
    ui.selectTrial("B");
    expect(ui.selectedTrialLetter).toBe("B");
  });

  it("selectCross writes the index against the active trial", () => {
    const ui = UiStore.create({});
    ui.selectCross(2);
    expect(ui.selectedCrossByTrial.get("A")).toBe(2);
  });

  it("selectCross(null) removes the active trial's entry rather than storing null", () => {
    const ui = UiStore.create({ selectedCrossByTrial: { A: 3 } });
    ui.selectCross(null);
    expect(ui.selectedCrossByTrial.has("A")).toBe(false);
  });

  it("selectCross writes against whichever trial is active", () => {
    const ui = UiStore.create({});
    ui.selectTrial("B");
    ui.selectCross(1);
    expect(ui.selectedCrossByTrial.get("B")).toBe(1);
    expect(ui.selectedCrossByTrial.has("A")).toBe(false);
  });

  it("selectTrial does NOT clear any per-trial selections", () => {
    const ui = UiStore.create({ selectedCrossByTrial: { A: 0, B: 1 } });
    ui.selectTrial("B");
    expect(ui.selectedCrossByTrial.get("A")).toBe(0);
    expect(ui.selectedCrossByTrial.get("B")).toBe(1);
  });

  it("clearSelection removes only the active trial's entry", () => {
    const ui = UiStore.create({ selectedCrossByTrial: { A: 0, B: 1 } });
    ui.clearSelection();
    expect(ui.selectedCrossByTrial.has("A")).toBe(false);
    expect(ui.selectedCrossByTrial.get("B")).toBe(1);
  });

  it("clearSelectionForTrial removes only the named trial's entry", () => {
    const ui = UiStore.create({ selectedCrossByTrial: { A: 0, B: 1 } });
    ui.clearSelectionForTrial("B");
    expect(ui.selectedCrossByTrial.get("A")).toBe(0);
    expect(ui.selectedCrossByTrial.has("B")).toBe(false);
  });

  it("snapshot shape is { selectedTrialLetter, selectedCrossByTrial }", () => {
    const ui = UiStore.create({ selectedTrialLetter: "B", selectedCrossByTrial: { B: 1 } });
    expect(getSnapshot(ui)).toEqual({ selectedTrialLetter: "B", selectedCrossByTrial: { B: 1 } });
  });
});
