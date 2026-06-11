#!/usr/bin/env tsx
//
// scripts/gen-workflows.ts — regenerate per-sim CI workflows from the template.
//
// Modes:
//   yarn gen-workflows          → regenerate every .github/workflows/sim-*.yml
//   yarn gen-workflows --check  → verify they match what would be generated
//
// The single source of truth for the sim list is the `simulations/*` directories
// (each with its own package.json) — same convention as gen-index.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const TEMPLATE_PATH = join(SCRIPT_DIR, "workflows", "sim-template.yml");
const WORKFLOWS_DIR = join(REPO_ROOT, ".github", "workflows");

export function renderWorkflow(template: string, simName: string): string {
  return template.replaceAll("__SIM_NAME__", simName);
}

export function discoverSims(): string[] {
  const simsDir = join(REPO_ROOT, "simulations");
  if (!existsSync(simsDir)) return [];
  return readdirSync(simsDir)
    .filter((name) => existsSync(join(simsDir, name, "package.json")))
    .sort();
}

function main() {
  const check = process.argv.includes("--check");
  const template = readFileSync(TEMPLATE_PATH, "utf8");
  const sims = discoverSims();
  let stale = false;
  for (const sim of sims) {
    const rendered = renderWorkflow(template, sim);
    const target = join(WORKFLOWS_DIR, `sim-${sim}.yml`);
    if (check) {
      const existing = existsSync(target) ? readFileSync(target, "utf8") : "";
      if (existing !== rendered) {
        console.error(`Stale workflow file: ${target}`);
        stale = true;
      }
    } else {
      writeFileSync(target, rendered);
      console.log(`Wrote ${target}`);
    }
  }
  if (check && stale) {
    console.error("\nRun `yarn gen-workflows` and commit the result.");
    process.exit(1);
  }
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) main();
