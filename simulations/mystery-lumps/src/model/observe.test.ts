import { describe, expect, it } from "vitest";
import { bathMeltStep, examine, massAfter, observe } from "./observe";

describe("observe", () => {
  it("names the salt by handling, and leaves two look-alike pairs", () => {
    expect(observe("sea-salt", "handle").caption).toMatch(/crystals/);
    // The pairs read word for word the same — that is the whole point.
    expect(observe("seashell", "handle").caption).toBe(observe("sea-glass", "handle").caption);
    expect(observe("paraffin", "handle").caption).toBe(observe("palm-oil", "handle").caption);
  });

  it("fizzes only the seashell in vinegar", () => {
    expect(observe("seashell", "vinegar").visual).toBe("fizzing");
    for (const s of ["sea-glass", "palm-oil", "paraffin"] as const) {
      expect(observe(s, "vinegar").visual).toBe("none");
    }
    // Salt dissolves in vinegar too — it is mostly water — but without bubbles.
    expect(observe("sea-salt", "vinegar").visual).toBe("dissolving");
  });

  it("notes that the vinegar is in an open container, whatever happens", () => {
    for (const s of ["seashell", "sea-salt", "paraffin"] as const) {
      expect(observe(s, "vinegar").caption).toMatch(/^In an open container\. /);
    }
    expect(observe("seashell", "water").caption).not.toMatch(/open container/);
  });

  it("dissolves the salt in water and leaves everything else alone", () => {
    expect(observe("sea-salt", "water").visual).toBe("dissolving");
    for (const s of ["seashell", "sea-glass", "palm-oil", "paraffin"] as const) {
      expect(observe(s, "water").visual).toBe("none");
    }
  });

  it("steps the bath through 30, 45 and 80 °C, splitting the waxes between the steps", () => {
    expect(observe("palm-oil", "bath")).toEqual({
      caption:
        "In a dry dish inside the bath. At 30 °C, nothing changes. At 45 °C, the lump softens " +
        "and slumps, then runs into a pool at the bottom of the dish. At 80 °C, the pool stays liquid.",
      visual: "melting",
    });
    expect(observe("paraffin", "bath")).toEqual({
      caption:
        "In a dry dish inside the bath. At 30 °C, nothing changes. At 45 °C, nothing changes. " +
        "At 80 °C, the lump turns glossy and soft, sags, then melts into a clear pool in the dish.",
      visual: "melting",
    });
    expect(bathMeltStep("palm-oil")).toBe(1);
    expect(bathMeltStep("paraffin")).toBe(2);
    expect(bathMeltStep("sea-salt")).toBeNull();
  });

  it("leaves the salt, shell and glass alone in the bath, since the dish keeps them dry", () => {
    for (const s of ["sea-salt", "seashell", "sea-glass"] as const) {
      expect(observe(s, "bath").visual).toBe("none");
      expect(observe(s, "bath").caption).toMatch(/At 80 °C, nothing changes\.$/);
    }
  });

  it("glows only the glass and the palm oil under the lamp", () => {
    expect(observe("sea-glass", "lamp").visual).toBe("glowing");
    expect(observe("palm-oil", "lamp").visual).toBe("glowing");
    expect(observe("seashell", "lamp").visual).toBe("none");
    expect(observe("sea-salt", "lamp").visual).toBe("none");
  });

  it("degrades the paraffin over the lamp's two weeks", () => {
    expect(observe("paraffin", "lamp").visual).toBe("degrading");
    expect(observe("paraffin", "lamp").caption).toMatch(/yellow/);
  });

  it("gives up the rancid smell only after the lamp has worked on the palm oil", () => {
    const lamped = { test: "lamp" } as const;
    expect(observe("palm-oil", "waft", null).visual).toBe("no-smell");
    expect(observe("palm-oil", "waft", { test: "bath" }).visual).toBe("no-smell");
    expect(observe("palm-oil", "waft", lamped).visual).toBe("rancid");
    // Nothing else smells, however it was treated.
    expect(observe("paraffin", "waft", lamped).visual).toBe("no-smell");
  });

  it("describes what the lump is like now, not what it was before its test", () => {
    const fresh = observe("palm-oil", "handle").caption;
    const melted = observe("palm-oil", "handle", { test: "bath" }).caption;
    expect(melted).not.toBe(fresh);
    expect(melted).toMatch(/pool/i);

    // Salt that has dissolved cannot be picked up at all.
    expect(observe("sea-salt", "handle", { test: "water" }).caption).toMatch(/nothing left/i);
    // Paraffin left under the lamp for a fortnight crumbles.
    expect(observe("paraffin", "handle", { test: "lamp" }).caption).toMatch(/brittle|chalky/i);
  });

  it("leaves a lump that its test did not change feeling the same", () => {
    const fresh = observe("sea-glass", "handle").caption;
    // Glass glows under the lamp but is otherwise untouched by it.
    expect(observe("sea-glass", "handle", { test: "lamp" }).caption).toBe(fresh);
    expect(observe("sea-glass", "handle", { test: "water" }).caption).toBe(fresh);
  });

  it("never interprets a result", () => {
    const banned = /carbonate|calcium|wax is|salt is|glass is|it is .*(oil|wax|shell|glass|salt)/i;
    for (const s of ["seashell", "sea-salt", "sea-glass", "palm-oil", "paraffin"] as const) {
      for (const t of ["handle", "waft", "water", "vinegar", "bath", "lamp"] as const) {
        expect(observe(s, t).caption).not.toMatch(banned);
      }
    }
  });
});

describe("massAfter", () => {
  it("drops to nothing when the lump dissolves", () => {
    expect(massAfter("sea-salt", "water", 67.3)).toBe(0);
  });

  it("loses a little when the shell fizzes, but not in plain water", () => {
    expect(massAfter("seashell", "vinegar", 97.2)).toBe(96.8);
    expect(massAfter("seashell", "water", 97.2)).toBe(97.2);
  });

  it("keeps all its mass when it only melts or softens", () => {
    expect(massAfter("palm-oil", "bath", 35.6)).toBe(35.6);
    expect(massAfter("paraffin", "bath", 34.2)).toBe(34.2);
  });

  it("loses the crumbled corner after two weeks under the lamp", () => {
    expect(massAfter("paraffin", "lamp", 34.2)).toBe(32.8);
  });
});

describe("examine", () => {
  it("describes the feel and the smell together, and draws what was felt", () => {
    const fresh = examine("palm-oil");
    expect(fresh.caption).toBe(
      "Waxy and pale. It gives a little under a fingernail. No smell to speak of.",
    );
    expect(fresh.visual).toBe("waxy");
    expect(examine("palm-oil", { test: "lamp" }).caption).toMatch(/rancid/);
  });
});
