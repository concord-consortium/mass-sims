import { getSnapshot } from "mobx-state-tree";
import { describe, expect, it } from "vitest";
import { UiStore } from "./ui-store";

describe("UiStore", () => {
  it("starts with no selection by default", () => {
    const ui = UiStore.create({ selectedCross: null });
    expect(ui.selectedCross).toBeNull();
  });

  it("selectCross sets the index", () => {
    const ui = UiStore.create({ selectedCross: null });
    ui.selectCross(2);
    expect(ui.selectedCross).toBe(2);
  });

  it("selectCross can set back to null", () => {
    const ui = UiStore.create({ selectedCross: 3 });
    ui.selectCross(null);
    expect(ui.selectedCross).toBeNull();
  });

  it("clearSelection resets to null", () => {
    const ui = UiStore.create({ selectedCross: 4 });
    ui.clearSelection();
    expect(ui.selectedCross).toBeNull();
  });

  it("snapshot shape is just { selectedCross }", () => {
    const ui = UiStore.create({ selectedCross: 1 });
    expect(getSnapshot(ui)).toEqual({ selectedCross: 1 });
  });
});
