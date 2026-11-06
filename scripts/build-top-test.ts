#!/usr/bin/env tsx
//
// scripts/build-top-test.ts — local-testing harness for the index-top.html promotion.
//
// Simulates the production S3 layout in a local `top-test/` directory so the
// dynamic-publicPath pattern can be exercised end-to-end without an actual deploy:
//
//   top-test/
//   ├── serve.json              ← keeps `serve` from redirecting …/index.html?query (see below)
//   ├── index.html              ← root landing page (copied from repo's index.html)
//   ├── sim-one/index.html      ← promoted (the index-top.html for sim-one)
//   ├── sim-two/index.html      ← promoted
//   ├── version/release/
//   │   ├── sim-one/...         ← the actual bundle
//   │   └── sim-two/...
//   ├── version/v0.0.0-test/    ← a release-tag deploy: landing page + every sim's dist/
//   └── branch/test-branch/     ← a branch deploy: landing page + every sim's dist/
//
// After running this, `yarn serve:top-test` serves the directory on http://localhost:8000
// and clicking through the sim links exercises:
//   - top-level HTML at /sim-one/ loading JS from /version/release/sim-one/
//   - JS's runtime-resolved asset URLs (the Vite renderBuiltUrl path)
//   - the landing page at all three deploy paths (/, /version/<tag>/, /branch/<name>/), each
//     loading its sims from beside it. The Playwright `landing-*` projects test these.
//
// This is the local equivalent of starter-projects' build:top-test / serve:top-test pair.

import { execSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const TOP_TEST = join(REPO_ROOT, "top-test");
const SIMS_DIR = join(REPO_ROOT, "simulations");
const VERSION_NAME = "release";
// Stand-ins for a release tag and a branch. They have the same file layout; both are kept because
// the landing page's footer shows something different for each.
const NESTED_DEPLOYS = ["version/v0.0.0-test", "branch/test-branch"];

// Clean any previous top-test/ output.
if (existsSync(TOP_TEST)) {
  rmSync(TOP_TEST, { recursive: true, force: true });
}

// Build all sims with the MASS_SIMS_VERSION_PATH set so generate-index-top.ts produces
// index-top.html with paths pointing to `../version/release/<sim>/`.
console.log(`Building all sims (MASS_SIMS_VERSION_PATH=version/${VERSION_NAME})`);
execSync("yarn build", {
  cwd: REPO_ROOT,
  stdio: "inherit",
  env: { ...process.env, MASS_SIMS_VERSION_PATH: `version/${VERSION_NAME}` },
});

// Regenerate the root index.html (in case the sim list changed).
console.log("Regenerating root index.html");
execSync("yarn gen-index", { cwd: REPO_ROOT, stdio: "inherit" });

// Set up the top-test/ layout.
mkdirSync(TOP_TEST, { recursive: true });

const sims = readdirSync(SIMS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .filter((e) => existsSync(join(SIMS_DIR, e.name, "package.json")))
  .map((e) => e.name);

for (const sim of sims) {
  const simDistDir = join(SIMS_DIR, sim, "dist");
  if (!existsSync(simDistDir)) {
    console.warn(`No dist/ for ${sim}, skipping`);
    continue;
  }

  // Copy the built bundle to top-test/version/release/<sim>/ — this is where index-top.html
  // expects to find the JS and assets.
  const versionedPath = join(TOP_TEST, "version", VERSION_NAME, sim);
  console.log(`Copying ${sim} dist/ → top-test/version/${VERSION_NAME}/${sim}/`);
  cpSync(simDistDir, versionedPath, { recursive: true });

  // Copy index-top.html as the "promoted" top-level HTML for this sim.
  const indexTop = join(simDistDir, "index-top.html");
  if (existsSync(indexTop)) {
    const promotedDir = join(TOP_TEST, sim);
    mkdirSync(promotedDir, { recursive: true });
    copyFileSync(indexTop, join(promotedDir, "index.html"));
    console.log(`Promoted ${sim} index-top.html → top-test/${sim}/index.html`);
  } else {
    console.warn(`No index-top.html for ${sim} — was postbuild script skipped?`);
  }
}

// Copy the root index.html so the landing page works in top-test/ too.
const rootIndex = join(REPO_ROOT, "index.html");
if (existsSync(rootIndex)) {
  copyFileSync(rootIndex, join(TOP_TEST, "index.html"));
  console.log("Copied root index.html → top-test/index.html");
}

// The nested deploys, laid out as CI uploads a branch or tag: the root index.html, and each sim's
// whole dist/ beside it.
for (const deploy of NESTED_DEPLOYS) {
  const deployDir = join(TOP_TEST, deploy);
  mkdirSync(deployDir, { recursive: true });
  copyFileSync(rootIndex, join(deployDir, "index.html"));
  for (const sim of sims) {
    const simDistDir = join(SIMS_DIR, sim, "dist");
    if (existsSync(simDistDir)) cpSync(simDistDir, join(deployDir, sim), { recursive: true });
  }
  console.log(`Copied index.html + every sim's dist/ → top-test/${deploy}/`);
}

// `serve` normally redirects …/index.html to a "clean" URL and drops the query string, so the
// landing page's iframe would lose ?standalone=true. Production does not redirect. Turning
// cleanUrls off entirely would also stop folders serving their index.html, so only exclude
// index.html from it.
writeFileSync(
  join(TOP_TEST, "serve.json"),
  `${JSON.stringify({ cleanUrls: ["!**/index.html"] }, null, 2)}\n`,
);
console.log("Wrote top-test/serve.json");

console.log("");
console.log("=== Done ===");
console.log("Now run: yarn serve:top-test");
console.log("Then visit: http://localhost:8000/");
