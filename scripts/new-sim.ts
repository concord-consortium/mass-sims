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
//      dist, coverage, .vite).
//   3. Substitutes the name + title placeholders.
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
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".vite", ".tsbuildinfo"]);

export function isValidSimName(name: string): boolean {
  if (!SIM_NAME_PATTERN.test(name)) return false;
  if (RESERVED.has(name)) return false;
  return true;
}

/**
 * Apply name/title substitutions. The substitution rules are file-specific so we
 * don't accidentally rewrite documentation prose that happens to contain the word
 * "starter".
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

function main() {
  const name = process.argv[2];
  if (!name) {
    console.error("Usage: yarn new-sim <name>");
    process.exit(1);
  }
  if (!isValidSimName(name)) {
    console.error(
      `Invalid sim name "${name}". Use kebab-case (lowercase, digits, hyphens; starting with a letter). ` +
        `Reserved: shared, starter, sim-frame-preview, mass-sims.`,
    );
    process.exit(1);
  }
  const targetDir = join(REPO_ROOT, "simulations", name);
  if (existsSync(targetDir)) {
    console.error(`Refusing to overwrite existing directory: ${targetDir}`);
    process.exit(1);
  }

  const sourceDir = join(REPO_ROOT, "packages", "starter");
  console.log(`Copying ${sourceDir} → ${targetDir}`);
  cpSync(sourceDir, targetDir, {
    recursive: true,
    filter: (src) => !SKIP_DIRS.has(basename(src)),
  });

  // Walk the copied tree and substitute.
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

  console.log(`\n✓ Scaffolded simulations/${name}`);
  console.log("\nNext steps:");
  console.log("  1. yarn install            # link the new workspace");
  console.log("  2. yarn gen-index          # refresh the root index.html");
  console.log("  3. yarn gen-workflows      # generate the per-sim CI workflow");
  console.log(`  4. Edit simulations/${name}/src/app.tsx — fill in simTitle and tagline`);
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
