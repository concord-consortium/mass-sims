#!/usr/bin/env tsx
//
// scripts/new-sim.ts — scaffold a new simulation from packages/starter.
//
// Usage:
//   yarn new-sim <name>
//
// Where <name> is the kebab-case name (matches the directory name AND the
// package name in package.json — they always agree).
//
// What it does:
//   1. Validates the name.
//   2. Copies packages/starter/ to simulations/<name>/ (skipping node_modules,
//      dist, coverage, .vite, and *.tsbuildinfo files) and substitutes name + title.
//   3. Wires up Playwright e2e coverage for the new sim:
//        a. appends a { name, port } entry to playwright/sims.ts (next free port),
//        b. copies playwright/pages/starter-page.ts → playwright/pages/<name>-page.ts,
//        c. copies playwright/testdata/starter-testdata.ts → playwright/testdata/<name>-testdata.ts,
//        d. copies playwright/tests/smoke/starter.test.ts → playwright/tests/smoke/<name>.test.ts.
//   4. Prints next-step reminders.
//
// Note: the root package.json `workspaces` array uses globs (`simulations/*`), so a
// new sim directory is picked up automatically — this script does NOT edit workspaces.

import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

const SIM_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const RESERVED = new Set(["shared", "starter", "sim-frame-preview", "mass-sims"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".vite"]);

/** Paths excluded from the starter copy: build/dep directories and any *.tsbuildinfo file. */
function shouldSkipCopy(src: string): boolean {
  const base = basename(src);
  return SKIP_DIRS.has(base) || base.endsWith(".tsbuildinfo");
}

export function isValidSimName(name: string): boolean {
  if (!SIM_NAME_PATTERN.test(name)) return false;
  if (RESERVED.has(name)) return false;
  return true;
}

/** kebab-case → PascalCase, e.g. "photo-synth" → "PhotoSynth". */
export function kebabToPascal(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

/**
 * Apply name/title substitutions to the copied SIM SOURCE. The rules are file-specific so we
 * don't accidentally rewrite documentation prose that happens to contain the word "starter".
 */
export function substituteInFile(
  content: string,
  oldName: string,
  newName: string,
  relPath: string,
): string {
  if (relPath.endsWith("package.json")) {
    return content.replace(`"name": "${oldName}"`, `"name": "${newName}"`);
  }
  if (relPath.endsWith("src/app.tsx")) {
    return content.replace(/simTitle=".*?"/, `simTitle="<NEW SIM TITLE>"`);
  }
  return content;
}

/** The next free preview port = max registered port + 1. */
export function nextSimPort(simsContent: string): number {
  const ports = [...simsContent.matchAll(/port:\s*(\d+)/g)].map((m) => Number(m[1]));
  if (ports.length === 0) {
    throw new Error("No ports found in playwright/sims.ts — cannot assign the next port.");
  }
  return Math.max(...ports) + 1;
}

/** Append a `{ name, port }` entry to the SIMS array in playwright/sims.ts. */
export function appendSimToRegistry(simsContent: string, name: string, port: number): string {
  if (simsContent.includes(`name: "${name}"`)) {
    throw new Error(`Sim "${name}" is already registered in playwright/sims.ts.`);
  }
  const entry = `  { name: "${name}", port: ${port} },\n`;
  const updated = simsContent.replace(
    /(export const SIMS: SimEntry\[\] = \[\n[\s\S]*?)(\];)/,
    (_match, body: string, tail: string) => `${body}${entry}${tail}`,
  );
  if (updated === simsContent) {
    throw new Error("Could not locate the SIMS array in playwright/sims.ts.");
  }
  return updated;
}

/**
 * Transform the canonical starter page object into a new sim's page object: substitute the class
 * name and the registry key its `goto()` reads, and prepend a "edit me" header. The Starter-specific
 * locators/actions are intentionally left in place as a working starting point.
 */
export function scaffoldPageObject(starterContent: string, name: string): string {
  const pascal = kebabToPascal(name);
  const header =
    `// Page object for the \`${name}\` sim, scaffolded from starter-page.ts by \`yarn new-sim\`.\n` +
    `// The locators and actions below are Starter's — replace them with this sim's own controls.\n` +
    `// The shared chrome (header, About modal, three slots) is inherited from SimulationFramePage.\n`;
  const body = starterContent
    .replaceAll("StarterPage", `${pascal}Page`)
    .replaceAll(`getSimUrl("starter")`, `getSimUrl("${name}")`);
  return header + body;
}

/**
 * Transform the canonical starter smoke spec into a new sim's smoke spec: substitute the page-object
 * class name and its import path, plus the asserted sim title (the scaffolded app.tsx renders the
 * "<NEW SIM TITLE>" placeholder, so the copied spec must assert the same placeholder to stay green
 * until the author customizes both).
 */
export function scaffoldSmokeTest(starterContent: string, name: string): string {
  const pascal = kebabToPascal(name);
  return starterContent
    .replaceAll("StarterPage", `${pascal}Page`)
    .replaceAll("starter-page", `${name}-page`)
    .replaceAll("starter-testdata", `${name}-testdata`)
    .replaceAll(`"Random Walk"`, `"<NEW SIM TITLE>"`);
}

/**
 * Transform the canonical starter testdata into a new sim's testdata: prepend an "edit me" header
 * and keep the body (the shared trial-list re-export, whose relative path is the same from any
 * testdata file). Sim-specific catalogs/fixtures are the author's to add.
 */
export function scaffoldTestdata(starterContent: string, name: string): string {
  const header =
    `// Test data for the \`${name}\` sim, scaffolded from starter-testdata.ts by \`yarn new-sim\`.\n` +
    `// It re-exports the shared trial-list constants every sim builds on; add this sim's own\n` +
    `// catalogs/fixtures as it grows (keep any imported sim modules pure — no React / vite-svg / scss).\n\n`;
  return header + starterContent;
}

/**
 * Scaffold a new sim end-to-end (source + Playwright coverage). Throws on any invalid input or
 * pre-existing target so callers (the CLI and the integration test) can react. Returns the
 * assigned preview port. Performs no logging — the CLI's main() owns user-facing output.
 */
export function scaffoldSim(name: string): { port: number } {
  if (!isValidSimName(name)) {
    throw new Error(
      `Invalid sim name "${name}". Use kebab-case (lowercase, digits, hyphens; starting with a ` +
        `letter). Reserved: shared, starter, sim-frame-preview, mass-sims.`,
    );
  }

  const targetDir = join(REPO_ROOT, "simulations", name);
  const pageTarget = join(REPO_ROOT, "playwright", "pages", `${name}-page.ts`);
  const smokeTarget = join(REPO_ROOT, "playwright", "tests", "smoke", `${name}.test.ts`);
  const testdataTarget = join(REPO_ROOT, "playwright", "testdata", `${name}-testdata.ts`);
  for (const path of [targetDir, pageTarget, smokeTarget, testdataTarget]) {
    if (existsSync(path)) throw new Error(`Refusing to overwrite existing path: ${path}`);
  }

  const simsPath = join(REPO_ROOT, "playwright", "sims.ts");
  const simsContent = readFileSync(simsPath, "utf8");
  const port = nextSimPort(simsContent);
  const updatedSims = appendSimToRegistry(simsContent, name, port);

  // 1. Copy + substitute the sim source.
  const sourceDir = join(REPO_ROOT, "packages", "starter");
  cpSync(sourceDir, targetDir, { recursive: true, filter: (src: string) => !shouldSkipCopy(src) });
  walk(targetDir, (filePath) => {
    // Normalize to forward slashes so substituteInFile's path checks (e.g. "src/app.tsx") work on
    // Windows, where filePath uses backslash separators.
    const relPath = filePath
      .slice(targetDir.length + 1)
      .split(sep)
      .join("/");
    const content = readFileSync(filePath, "utf8");
    const next = substituteInFile(content, "starter", name, relPath);
    if (next !== content) writeFileSync(filePath, next);
  });

  // 2. Write the updated sims registry (computed above).
  writeFileSync(simsPath, updatedSims);

  // 3. Scaffold the page object from the Starter template.
  const starterPage = readFileSync(
    join(REPO_ROOT, "playwright", "pages", "starter-page.ts"),
    "utf8",
  );
  writeFileSync(pageTarget, scaffoldPageObject(starterPage, name));

  // 4. Scaffold the testdata module from the Starter template (the smoke spec imports it).
  const starterTestdata = readFileSync(
    join(REPO_ROOT, "playwright", "testdata", "starter-testdata.ts"),
    "utf8",
  );
  writeFileSync(testdataTarget, scaffoldTestdata(starterTestdata, name));

  // 5. Scaffold the smoke spec from the Starter template.
  const starterSmoke = readFileSync(
    join(REPO_ROOT, "playwright", "tests", "smoke", "starter.test.ts"),
    "utf8",
  );
  writeFileSync(smokeTarget, scaffoldSmokeTest(starterSmoke, name));

  return { port };
}

function main() {
  const name = process.argv[2];
  if (!name) {
    console.error("Usage: yarn new-sim <name>");
    process.exit(1);
  }

  let port: number;
  try {
    ({ port } = scaffoldSim(name));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  console.log(`✓ Scaffolded simulations/${name}`);
  console.log(`  + playwright/pages/${name}-page.ts`);
  console.log(`  + playwright/testdata/${name}-testdata.ts`);
  console.log(`  + playwright/tests/smoke/${name}.test.ts`);
  console.log(`  + playwright/sims.ts entry (preview port ${port})`);
  console.log("\nNext steps:");
  console.log("  1. yarn install            # link the new workspace");
  console.log("  2. yarn gen-index          # refresh the root index.html");
  console.log("  3. yarn gen-workflows      # generate the per-sim CI workflow");
  console.log(`  4. Edit simulations/${name}/src/app.tsx — fill in simTitle and tagline`);
  console.log(`  5. Update the "<NEW SIM TITLE>" assertion in the new smoke spec to match`);
  console.log(`  6. yarn test:playwright:build playwright/tests/smoke/${name}.test.ts`);
}

function walk(dir: string, visit: (filePath: string) => void) {
  for (const entry of readdirSync(dir)) {
    const filePath = join(dir, entry);
    const s = statSync(filePath);
    if (s.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      walk(filePath, visit);
    } else {
      visit(filePath);
    }
  }
}

// Run main() only when executed directly (not when imported by tests).
const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) main();
