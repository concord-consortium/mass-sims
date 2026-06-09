import { describe, expect, it } from "vitest";
import { isValidSimName, substituteInFile } from "./new-sim";

describe("isValidSimName", () => {
  it("accepts kebab-case names", () => {
    expect(isValidSimName("bananas")).toBe(true);
    expect(isValidSimName("sim-one")).toBe(true);
    expect(isValidSimName("photo-synth-2")).toBe(true);
  });

  it("rejects names with uppercase, spaces, underscores, or leading hyphens", () => {
    expect(isValidSimName("Bananas")).toBe(false);
    expect(isValidSimName("photo synth")).toBe(false);
    expect(isValidSimName("photo_synth")).toBe(false);
    expect(isValidSimName("-leading")).toBe(false);
    expect(isValidSimName("")).toBe(false);
  });

  it("rejects reserved words", () => {
    expect(isValidSimName("shared")).toBe(false);
    expect(isValidSimName("starter")).toBe(false);
    expect(isValidSimName("sim-frame-preview")).toBe(false);
  });
});

describe("substituteInFile", () => {
  it("replaces the package name in package.json", () => {
    const before = `{ "name": "starter", "version": "0.0.1" }`;
    const after = substituteInFile(before, "starter", "bananas", "package.json");
    expect(after).toContain(`"name": "bananas"`);
  });

  it("does NOT touch unrelated occurrences of the substring", () => {
    const before = `// starter is the template — see infrastructure-plan.md`;
    const after = substituteInFile(before, "starter", "bananas", "src/comment.ts");
    // Heuristic: only replace name-shaped occurrences, not arbitrary prose.
    expect(after).toBe(before);
  });

  it("replaces the sim title in app.tsx", () => {
    const before = `simTitle="Random Walk"`;
    const after = substituteInFile(before, "starter", "bananas", "src/app.tsx");
    expect(after).toContain(`simTitle="<NEW SIM TITLE>"`);
  });
});
