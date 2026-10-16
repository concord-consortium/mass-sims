import { describe, expect, it } from "vitest";
import { observe } from "./observe";

describe("observe", () => {
  it("names the salt by handling, and leaves two look-alike pairs", () => {
    expect(observe("sea-salt", "handle", null).caption).toMatch(/crystals/);
    // The pairs read word for word the same — that is the whole point.
    expect(observe("seashell", "handle", null).caption).toBe(
      observe("sea-glass", "handle", null).caption,
    );
    expect(observe("paraffin", "handle", null).caption).toBe(
      observe("palm-oil", "handle", null).caption,
    );
  });

  it("fizzes only the seashell in vinegar", () => {
    expect(observe("seashell", "vinegar", null).visual).toBe("fizzing");
    for (const s of ["sea-glass", "palm-oil", "paraffin"] as const) {
      expect(observe(s, "vinegar", null).visual).toBe("none");
    }
    // Salt dissolves in vinegar too — it is mostly water — but without bubbles.
    expect(observe("sea-salt", "vinegar", null).visual).toBe("dissolving");
  });

  it("dissolves the salt in water and leaves everything else alone", () => {
    expect(observe("sea-salt", "water", null).visual).toBe("dissolving");
    for (const s of ["seashell", "sea-glass", "palm-oil", "paraffin"] as const) {
      expect(observe(s, "water", null).visual).toBe("none");
    }
  });

  it("splits the waxes on either side of their softening points", () => {
    expect(observe("palm-oil", "bath", "20").visual).toBe("none");
    expect(observe("palm-oil", "bath", "40").visual).toBe("melting");
    expect(observe("paraffin", "bath", "40").visual).toBe("none");
    expect(observe("paraffin", "bath", "60").visual).toBe("softening");
  });

  it("never changes the shell or the glass in the bath, at any temperature", () => {
    for (const temp of ["20", "40", "60", "80"] as const) {
      expect(observe("seashell", "bath", temp).visual).toBe("none");
      expect(observe("sea-glass", "bath", temp).visual).toBe("none");
    }
  });

  it("dissolves the salt at every bath temperature, faster when warm", () => {
    expect(observe("sea-salt", "bath", "20").visual).toBe("dissolving");
    expect(observe("sea-salt", "bath", "20").caption).toMatch(/slowly/);
    expect(observe("sea-salt", "bath", "80").caption).toMatch(/quickly/);
  });

  it("glows the glass and the palm oil at any exposure, and nothing else ever", () => {
    for (const e of ["seconds", "hour", "day", "fortnight"] as const) {
      expect(observe("sea-glass", "lamp", e).visual).toBe("glowing");
      expect(observe("palm-oil", "lamp", e).visual).toBe("glowing");
      expect(observe("seashell", "lamp", e).visual).toBe("none");
      expect(observe("sea-salt", "lamp", e).visual).toBe("none");
    }
  });

  it("degrades the paraffin only after the long exposure", () => {
    expect(observe("paraffin", "lamp", "day").visual).toBe("none");
    expect(observe("paraffin", "lamp", "fortnight").visual).toBe("degrading");
    expect(observe("paraffin", "lamp", "fortnight").caption).toMatch(/yellow/);
  });

  it("gives up the rancid smell only after the lamp has worked on the palm oil", () => {
    const noSmell = { test: "lamp", setting: "hour" } as const;
    const degraded = { test: "lamp", setting: "day" } as const;
    expect(observe("palm-oil", "waft", null, null).visual).toBe("no-smell");
    expect(observe("palm-oil", "waft", null, noSmell).visual).toBe("no-smell");
    expect(observe("palm-oil", "waft", null, degraded).visual).toBe("rancid");
    // Nothing else smells, however it was treated.
    expect(observe("paraffin", "waft", null, degraded).visual).toBe("no-smell");
  });

  it("never interprets a result", () => {
    const banned = /carbonate|calcium|wax is|salt is|glass is|it is .*(oil|wax|shell|glass|salt)/i;
    for (const s of ["seashell", "sea-salt", "sea-glass", "palm-oil", "paraffin"] as const) {
      for (const t of ["handle", "waft", "water", "vinegar"] as const) {
        expect(observe(s, t, null).caption).not.toMatch(banned);
      }
      for (const temp of ["20", "40", "60", "80"] as const) {
        expect(observe(s, "bath", temp).caption).not.toMatch(banned);
      }
      for (const e of ["seconds", "hour", "day", "fortnight"] as const) {
        expect(observe(s, "lamp", e).caption).not.toMatch(banned);
      }
    }
  });

  it("states the time each test stands for", () => {
    expect(observe("sea-glass", "lamp", "fortnight").elapsed).toBe("two weeks");
    expect(observe("sea-salt", "water", null).elapsed).toBe("30 seconds");
  });
});
