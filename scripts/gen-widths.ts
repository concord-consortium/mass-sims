#!/usr/bin/env tsx
//
// scripts/gen-widths.ts — generate the SCSS layout-dimension tokens from their TypeScript
// definition, so the four target widths are defined exactly once in the repo.
//
// Modes:
//   yarn gen-widths            → regenerate packages/shared/src/styles/_widths.generated.scss
//   yarn gen-widths --check    → verify it matches what would be generated; exit non-zero if stale
//
// CI runs --check on every push (alongside gen-index / gen-workflows), so editing a width in
// target-widths.ts without regenerating fails the build rather than silently desynchronizing the
// TypeScript from the CSS.
//
// Why this direction? TypeScript → SCSS, not the reverse. `:export` from a `.module.scss` only
// yields a JS object when a *bundler* transforms the file, and two of the consumers here never see
// one: `playwright.config.ts` is loaded by plain Node, and so is this script. Generating the SCSS
// keeps every consumer working and needs no build-time magic.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FRAME_HEIGHT, TARGET_WIDTHS } from "../packages/shared/src/layout/target-widths";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const OUTPUT_PATH = join(
  REPO_ROOT,
  "packages",
  "shared",
  "src",
  "styles",
  "_widths.generated.scss",
);

/** Pad the value column so the generated file matches the alignment style of `tokens.scss`. */
function pad(name: string, width = 36): string {
  return `${name}:`.padEnd(width);
}

export function renderScss(frameHeight: number, widths: readonly TargetWidthLike[]): string {
  const tokens = widths.map((w) => w.token);
  const duplicates = tokens.filter((token, i) => tokens.indexOf(token) !== i);
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate token(s) in TARGET_WIDTHS: ${[...new Set(duplicates)].join(", ")}. ` +
        `Each width's token becomes a Sass variable name ($frame-width-<token>), so they must be unique.`,
    );
  }

  const lines = widths.map(
    (w) => `${pad(`$frame-width-${w.token}`)}${w.px}px;${w.comment ? `   // ${w.comment}` : ""}`,
  );

  return `// =============================================================================
// GENERATED FILE — DO NOT EDIT.
//
// Written by \`yarn gen-widths\` from packages/shared/src/layout/target-widths.ts,
// which is the single source of truth for these numbers (the width preview and
// playwright.config.ts read the same module). CI runs \`yarn gen-widths --check\`,
// so a hand-edit here — or a change there without regenerating — fails the build.
//
// Forwarded by tokens.scss, so stylesheets reach these as \`tokens.$frame-height\`
// (never by @use-ing this file directly).
// =============================================================================

// The height Activity Player gives the sim iframe. Fixed across all four modes.
${pad("$frame-height")}${frameHeight}px;

// The four widths a sim's layout must work within.
${lines.join("\n")}
`;
}

interface TargetWidthLike {
  token: string;
  px: number;
  label?: string;
  comment?: string;
}

function main() {
  const check = process.argv.includes("--check");

  let expected: string;
  try {
    expected = renderScss(FRAME_HEIGHT, TARGET_WIDTHS);
  } catch (err) {
    // A bad TARGET_WIDTHS is a source error, not a crash — report it the way the other failures here
    // read, in both modes (a `--check` run in CI should say what's wrong, not print a stack trace).
    console.error(`gen-widths: ${(err as Error).message}`);
    process.exit(1);
  }

  if (check) {
    const actual = existsSync(OUTPUT_PATH) ? readFileSync(OUTPUT_PATH, "utf8") : "";
    if (actual !== expected) {
      console.error("gen-widths: _widths.generated.scss is out of date with target-widths.ts.");
      console.error("            Run `yarn gen-widths` to regenerate, then commit the result.");
      process.exit(1);
    }
    console.log("gen-widths: _widths.generated.scss is up to date.");
    return;
  }

  writeFileSync(OUTPUT_PATH, expected);
  console.log(`gen-widths: wrote _widths.generated.scss with ${TARGET_WIDTHS.length} width(s).`);
}

// Only run when invoked as a script, so the test can import `renderScss` without side effects.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
