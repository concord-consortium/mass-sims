import { applySnapshot, getSnapshot } from "mobx-state-tree";
import { describe, expect, it } from "vitest";
import { UiStore } from "./ui-store";

describe("UiStore", () => {
  it("defaults to trial A", () => {
    const ui = UiStore.create();
    expect(ui.selectedTrialLetter).toBe("A");
  });

  it("keeps one selected sample per trial, through a trial switch", () => {
    const ui = UiStore.create();
    expect(ui.selectedSampleId("A")).toBeNull();
    ui.selectSample("A", 2);
    ui.selectTrial("B");
    ui.selectSample("B", 5);
    ui.selectTrial("A");
    expect(ui.selectedSampleId("A")).toBe(2);
    expect(ui.selectedSampleId("B")).toBe(5);
    ui.selectSample("A", null);
    expect(ui.selectedSampleId("A")).toBeNull();
    expect(ui.selectedSampleId("B")).toBe(5);
  });

  it("clearSampleSelections clears every trial's selection", () => {
    const ui = UiStore.create();
    ui.selectSample("A", 1);
    ui.selectSample("B", 2);
    ui.clearSampleSelections();
    expect(ui.selectedSampleId("A")).toBeNull();
    expect(ui.selectedSampleId("B")).toBeNull();
  });

  it("replaces the selection object on every write, so observers see the change", () => {
    const ui = UiStore.create();
    const before = ui.selectedSampleByTrial;
    ui.selectSample("A", 1);
    expect(ui.selectedSampleByTrial).not.toBe(before);
  });

  it("cycles the sort ascending → descending → none, and starts a new key at ascending", () => {
    const ui = UiStore.create();
    expect(ui.sort).toEqual({ key: null, direction: 1 });
    ui.cycleSort("rate");
    expect(ui.sort).toEqual({ key: "rate", direction: 1 });
    ui.cycleSort("rate");
    expect(ui.sort).toEqual({ key: "rate", direction: -1 });
    ui.cycleSort("rate");
    expect(ui.sort).toEqual({ key: null, direction: 1 });
    ui.cycleSort("rate");
    ui.cycleSort("rate");
    ui.cycleSort("roof");
    expect(ui.sort).toEqual({ key: "roof", direction: 1 });
  });

  it("keeps the selection and sort out of snapshots", () => {
    const ui = UiStore.create();
    ui.selectSample("A", 1);
    ui.cycleSort("years");
    expect(getSnapshot(ui)).toEqual({ selectedTrialLetter: "A" });
    applySnapshot(ui, { selectedTrialLetter: "B" });
    expect(ui.selectedSampleId("A")).toBe(1);
    expect(ui.sort.key).toBe("years");
  });

  it("starts closed with no pin", () => {
    const ui = UiStore.create();
    expect(ui.compareOpen).toBe(false);
    expect(ui.pinnedYear).toBeNull();
  });

  it("openCompare opens the view and sets the pin; closeCompare leaves the pin", () => {
    const ui = UiStore.create();
    ui.openCompare(50000);
    expect(ui.compareOpen).toBe(true);
    expect(ui.isPinned(50000)).toBe(true);
    ui.closeCompare();
    expect(ui.compareOpen).toBe(false);
    expect(ui.pinnedYear).toBe(50000);
  });

  it("togglePin pins a year, moves to another, and clears on the pinned year", () => {
    const ui = UiStore.create();
    ui.togglePin(50000);
    expect(ui.isPinned(50000)).toBe(true);
    ui.togglePin(0);
    expect(ui.isPinned(50000)).toBe(false);
    expect(ui.isPinned(0)).toBe(true);
    ui.togglePin(0);
    expect(ui.pinnedYear).toBeNull();
  });

  it("keeps the compare state out of snapshots", () => {
    const ui = UiStore.create();
    ui.openCompare(0);
    expect(getSnapshot(ui)).toEqual({ selectedTrialLetter: "A" });
    applySnapshot(ui, { selectedTrialLetter: "B" });
    expect(ui.compareOpen).toBe(true);
    expect(ui.pinnedYear).toBe(0);
  });
});
