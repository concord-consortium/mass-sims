import { describe, expect, it } from "vitest";
import { fillerHeight } from "./use-filler-height";

describe("fillerHeight", () => {
  it("fills the scroller's spare height", () => {
    // 254px scroller; 52px header + one 48px row + 32px average row, filler at 0.
    expect(fillerHeight(254, 132, 0)).toBe(122);
  });

  it("measures the table without the filler's current height, so a re-run is stable", () => {
    expect(fillerHeight(254, 254, 122)).toBe(122);
  });

  it("is 1px, never less, once the rows fill the scroller", () => {
    expect(fillerHeight(254, 420, 0)).toBe(1);
    expect(fillerHeight(254, 420 + 40, 40)).toBe(1);
  });
});
