import { describe, expect, it } from "vitest";
import { arrowTint, tempTint } from "./selection-tint";

describe("tempTint", () => {
  it("maps Warm → warm", () => {
    expect(tempTint("Warm")).toBe("warm");
  });

  it("maps land Cold and ocean Cool → cool", () => {
    expect(tempTint("Cold")).toBe("cool");
    expect(tempTint("Cool")).toBe("cool");
  });

  it("maps no temperature (null) → neutral", () => {
    expect(tempTint(null)).toBe("neutral");
  });
});

describe("arrowTint", () => {
  it("leaves every arrow neutral + undimmed with no selections", () => {
    for (const n of [1, 2, 3, 4]) {
      expect(arrowTint(n, null, null, null)).toEqual({ tint: "neutral", dimmed: false });
    }
  });

  it("tints the chosen land arrow by land temperature and dims its sibling", () => {
    // N/NW (arrow 1) + Cold → arrow 1 cool; arrow 4 dimmed; ocean arrows untouched.
    expect(arrowTint(1, "N/NW", "Cold", null)).toEqual({ tint: "cool", dimmed: false });
    expect(arrowTint(4, "N/NW", "Cold", null)).toEqual({ tint: "neutral", dimmed: true });
    expect(arrowTint(2, "N/NW", "Cold", null)).toEqual({ tint: "neutral", dimmed: false });
    // W (arrow 4) + Warm → arrow 4 warm; arrow 1 dimmed.
    expect(arrowTint(4, "W", "Warm", null)).toEqual({ tint: "warm", dimmed: false });
    expect(arrowTint(1, "W", "Warm", null)).toEqual({ tint: "neutral", dimmed: true });
  });

  it("uses selected-neutral for a chosen land pathway before its temperature is set", () => {
    expect(arrowTint(1, "N/NW", null, null)).toEqual({ tint: "selected-neutral", dimmed: false });
  });

  it("tints the chosen ocean arrow by derived ocean temperature and dims its sibling", () => {
    // S/SE (arrow 2) → warm; arrow 3 dimmed. NE (arrow 3) → cool; arrow 2 dimmed.
    expect(arrowTint(2, null, null, "S/SE")).toEqual({ tint: "warm", dimmed: false });
    expect(arrowTint(3, null, null, "S/SE")).toEqual({ tint: "neutral", dimmed: true });
    expect(arrowTint(3, null, null, "NE")).toEqual({ tint: "cool", dimmed: false });
    expect(arrowTint(2, null, null, "NE")).toEqual({ tint: "neutral", dimmed: true });
  });
});
