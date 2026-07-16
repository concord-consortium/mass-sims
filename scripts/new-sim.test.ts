import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendSimToRegistry,
  isValidSimName,
  kebabToPascal,
  nextSimPort,
  scaffoldSim,
  substituteInFile,
} from "./new-sim";

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
    expect(isValidSimName("mass-sims")).toBe(false);
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

describe("kebabToPascal", () => {
  it("converts kebab-case to PascalCase", () => {
    expect(kebabToPascal("starter")).toBe("Starter");
    expect(kebabToPascal("photo-synth")).toBe("PhotoSynth");
    expect(kebabToPascal("a-b-c")).toBe("ABC");
  });
});

describe("nextSimPort", () => {
  it("returns one past the highest registered port", () => {
    expect(nextSimPort('{ name: "a", port: 8080 },\n{ name: "b", port: 8081 },')).toBe(8082);
  });
  it("throws when no ports are present", () => {
    expect(() => nextSimPort("export const SIMS = [];")).toThrow();
  });
});

describe("appendSimToRegistry", () => {
  const REGISTRY = [
    "export const SIMS: SimEntry[] = [",
    '  { name: "starter", port: 8080 },',
    '  { name: "bananas", port: 8081 },',
    "];",
    "",
  ].join("\n");

  it("inserts a new entry before the closing bracket", () => {
    const out = appendSimToRegistry(REGISTRY, "test-sim", 8082);
    expect(out).toContain('  { name: "test-sim", port: 8082 },');
    // Order preserved: the new entry comes after bananas and before the closer.
    expect(out.indexOf("bananas")).toBeLessThan(out.indexOf("test-sim"));
    expect(out.indexOf("test-sim")).toBeLessThan(out.indexOf("];"));
  });

  it("throws when the SIMS array can't be found", () => {
    expect(() => appendSimToRegistry("no array here", "x", 1)).toThrow();
  });

  it("throws when the sim name is already registered", () => {
    expect(() => appendSimToRegistry(REGISTRY, "bananas", 9999)).toThrow(/already registered/);
  });
});

// Full-chain integration check: run the scaffolder against a throwaway sim name, assert the file
// shape + registry append + substitutions, and confirm the generated Playwright TS files
// type-check. Reverts every change so the working tree is unchanged.
describe("scaffoldSim integration", () => {
  const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  // The pre-clean below force-removes these paths before each run (which is what defeats scaffoldSim's
  // own "refuse to overwrite" guard), so the test sim name must be one no real sim would ever take, or
  // this test could delete tracked sources. Fixed (not PID-based) so a crashed run's leftovers are always
  // found and cleared by the next run's pre-clean.
  const TEST_SIM = "new-sim-test-throwaway-sim";
  const TEST_SIM_CLASS = `${kebabToPascal(TEST_SIM)}Page`;
  const simDir = join(REPO_ROOT, "simulations", TEST_SIM);
  const pageFile = join(REPO_ROOT, "playwright", "pages", `${TEST_SIM}-page.ts`);
  const testdataFile = join(REPO_ROOT, "playwright", "testdata", `${TEST_SIM}-testdata.ts`);
  const smokeFile = join(REPO_ROOT, "playwright", "tests", "smoke", `${TEST_SIM}.test.ts`);
  const simsPath = join(REPO_ROOT, "playwright", "sims.ts");
  // Matches a stray registry entry for TEST_SIM left behind by a prior aborted run.
  const strayEntry = new RegExp(`\\n? *\\{ name: "${TEST_SIM}",[^}]*\\},`, "g");

  // The clean registry, with any stray TEST_SIM entry from a prior aborted run stripped out.
  let cleanRegistry: string;

  function removeArtifacts() {
    rmSync(simDir, { recursive: true, force: true });
    rmSync(pageFile, { force: true });
    rmSync(testdataFile, { force: true });
    rmSync(smokeFile, { force: true });
  }

  beforeEach(() => {
    removeArtifacts();
    cleanRegistry = readFileSync(simsPath, "utf8").replace(strayEntry, "");
    writeFileSync(simsPath, cleanRegistry);
  });

  afterEach(() => {
    removeArtifacts();
    writeFileSync(simsPath, cleanRegistry);
  });

  it("scaffolds sim source, page object, smoke spec, and a registry entry that all type-check", () => {
    // Derive the expected port from the current registry (not a hardcoded literal) so this stays
    // correct as real sims are added — it's whatever nextSimPort would assign before scaffolding.
    const expectedPort = nextSimPort(cleanRegistry);
    const { port } = scaffoldSim(TEST_SIM);
    expect(port).toBe(expectedPort);

    // Sim source substitutions.
    expect(existsSync(simDir)).toBe(true);
    expect(readFileSync(join(simDir, "package.json"), "utf8")).toContain(`"name": "${TEST_SIM}"`);
    expect(readFileSync(join(simDir, "src", "app.tsx"), "utf8")).toContain(
      'simTitle="<NEW SIM TITLE>"',
    );

    // Registry append.
    expect(readFileSync(simsPath, "utf8")).toContain(
      `{ name: "${TEST_SIM}", port: ${expectedPort} }`,
    );

    // Page object: class name + registry-key substitution, no leftover StarterPage references.
    const page = readFileSync(pageFile, "utf8");
    expect(page).toContain(`class ${TEST_SIM_CLASS}`);
    expect(page).toContain(`getSimUrl("${TEST_SIM}")`);
    expect(page).not.toContain("StarterPage");

    // Testdata: scaffolded as its own per-sim module re-exporting the shared constants, with the
    // Starter-specific header stripped so the generated file describes the new sim, not Starter.
    expect(existsSync(testdataFile)).toBe(true);
    const testdata = readFileSync(testdataFile, "utf8");
    expect(testdata).toContain("packages/shared/src/trials/constants");
    expect(testdata).toContain(`for the \`${TEST_SIM}\` sim`);
    expect(testdata).not.toContain("for the Starter e2e suite");

    // Smoke spec: import paths + class substitution, no leftover Starter references.
    const smoke = readFileSync(smokeFile, "utf8");
    expect(smoke).toContain(`from "../../pages/${TEST_SIM}-page"`);
    expect(smoke).toContain(`from "../../testdata/${TEST_SIM}-testdata"`);
    expect(smoke).toContain(TEST_SIM_CLASS);
    expect(smoke).not.toContain("StarterPage");
    expect(smoke).not.toContain("starter-testdata");

    // The generated Playwright TS files must type-check (catches a broken class-name or
    // import-path substitution immediately).
    expect(() =>
      execSync("yarn typecheck:playwright", {
        cwd: REPO_ROOT,
        stdio: "pipe",
      }),
    ).not.toThrow();
  }, 30_000); // tsc spawn can take a few seconds
});
