import { describe, expect, it } from "vitest";
import { UiStore } from "./ui-store";

describe("UiStore base", () => {
  it("defaults the selected trial letter to A", () => {
    const ui = UiStore.create({});
    expect(ui.selectedTrialLetter).toBe("A");
  });

  it("selectTrial sets the active letter", () => {
    const ui = UiStore.create({});
    ui.selectTrial("C");
    expect(ui.selectedTrialLetter).toBe("C");
  });

  it("rejects a letter outside the A–J enumeration at runtime", () => {
    const ui = UiStore.create({});
    expect(() => ui.selectTrial("Z")).toThrow();
  });
});
