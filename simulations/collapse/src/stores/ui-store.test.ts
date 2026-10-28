import { applySnapshot, getSnapshot } from "mobx-state-tree";
import { describe, expect, it } from "vitest";
import { TIMELINE_VALUES } from "../model/timeline";
import { UiStore } from "./ui-store";

const LAST = TIMELINE_VALUES.length - 1;

describe("UiStore", () => {
  it("defaults to trial A and the first timeline value", () => {
    const ui = UiStore.create();
    expect(ui.selectedTrialLetter).toBe("A");
    expect(ui.timelineIndex).toBe(0);
    expect(ui.sampleYears).toBe(200000);
    expect(ui.canStepEarlier).toBe(false);
    expect(ui.canStepLater).toBe(true);
  });

  it("clamps setTimelineIndex at both ends", () => {
    const ui = UiStore.create();
    ui.setTimelineIndex(-3);
    expect(ui.timelineIndex).toBe(0);
    ui.setTimelineIndex(LAST + 5);
    expect(ui.timelineIndex).toBe(LAST);
  });

  it("keeps the timeline index out of snapshots, so a restore does not reset it", () => {
    const ui = UiStore.create();
    ui.setTimelineIndex(5);
    expect(getSnapshot(ui)).not.toHaveProperty("timelineIndex");
    applySnapshot(ui, { selectedTrialLetter: "B" });
    expect(ui.selectedTrialLetter).toBe("B");
    expect(ui.timelineIndex).toBe(5);
  });

  it("tracks sampleYears, canStepEarlier, and canStepLater with the index", () => {
    const ui = UiStore.create();
    ui.setTimelineIndex(1);
    expect(ui.sampleYears).toBe(150000);
    expect(ui.canStepEarlier).toBe(true);
    expect(ui.canStepLater).toBe(true);
    ui.setTimelineIndex(LAST);
    expect(ui.sampleYears).toBe(0);
    expect(ui.canStepEarlier).toBe(true);
    expect(ui.canStepLater).toBe(false);
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
});
