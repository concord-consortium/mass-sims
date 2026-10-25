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
});
