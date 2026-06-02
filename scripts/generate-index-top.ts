#!/usr/bin/env tsx
//
// scripts/generate-index-top.ts — post-build step run from each sim's directory.
//
// Reads `dist/index.html` for the current sim, rewrites the `src="./..."` and
// `href="./..."` attributes to reference the bundle's eventual versioned location, and
// writes the result to `dist/index-top.html`. CI uploads this file alongside the
// versioned `index.html`; the Release workflow later copies it to the top-level
// `<sim>/index.html` on S3, so a single bundle can be served from both the versioned
// URL and the top-level "released" URL.
//
// See docs/infrastructure-plan.md §8 for the full pattern and the Webpack-equivalent.
//
// Run from a sim's directory (automatically via `postbuild` script):
//   tsx ../../scripts/generate-index-top.ts
//
// Env vars:
//   MASS_SIMS_VERSION_PATH — the version-or-branch prefix component (e.g. "version/v1.2.3"
//                            or "branch/main"). Defaults to "version/release" for local
//                            testing. CI sets this from the deploy_path step.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const cwd = process.cwd();
const simName = basename(cwd);
const versionPath = process.env.MASS_SIMS_VERSION_PATH ?? "version/release";

// `prefix` is the relative path from `<top-level>/<sim>/index.html` to the bundle's
// actual location at `<versionPath>/<sim>/`. From `/mass-sims/sim-one/` going to
// `/mass-sims/version/v1.2.3/sim-one/`, that's `../version/v1.2.3/sim-one/`.
const prefix = `../${versionPath}/${simName}/`;

const inputPath = join(cwd, "dist", "index.html");
const outputPath = join(cwd, "dist", "index-top.html");

if (!existsSync(inputPath)) {
  console.error(`generate-index-top: ${inputPath} does not exist. Did vite build run?`);
  process.exit(1);
}

const html = readFileSync(inputPath, "utf8");

// Replace `src="./` and `href="./` (single or double quoted) with the versioned prefix.
// These are the only patterns Vite emits in HTML when `base: "./"` is set. We deliberately
// don't touch other occurrences of `./` so things like inline CSS `url(./...)` aren't
// affected.
const transformed = html
  .replace(/\b(src|href)="\.\//g, `$1="${prefix}`)
  .replace(/\b(src|href)='\.\//g, `$1='${prefix}`);

writeFileSync(outputPath, transformed);

console.log(`generate-index-top: wrote ${outputPath} (prefix: ${prefix})`);
