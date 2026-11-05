#!/usr/bin/env tsx
//
// scripts/gen-index.ts — generates the root index.html that lists all simulations.
//
// Reads the `workspaces` array from the root package.json, discovers every directory
// inside `simulations/*` that has its own package.json, and writes a static HTML page
// linking to each. Each sim's `massSims` block in its package.json gives its display
// title, grade band, order, title font and colors. A sim without one is left off the
// page, and the script prints a warning.
//
// Modes:
//   yarn gen-index            → regenerate index.html (overwrites)
//   yarn gen-index --check    → verify index.html matches what would be generated;
//                               exits non-zero with a hint if it's stale
//
// CI runs --check on every push so the committed index.html never drifts from the
// workspace list. Developers run `yarn gen-index` (no flag) after adding/removing a
// sim, then commit the regenerated index.html alongside their sim change.
//
// Note: this script ignores `packages/*` workspaces (shared library, starter template);
// only `simulations/*` are user-facing and listed in the index.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

/** The wordmark font: the same settings as the sim's own `.sim-title`. */
export interface TitleFont {
  family: string;
  letterSpacing?: string;
  offsetY?: string;
  size?: string;
}

/** The sim's palette, as the landing page uses it. Each value also appears in its `theme.scss`. */
export interface SimColors {
  surface: string;
  text: string;
  border: string;
  hover: string;
  active: string;
  selectedText: string;
}

/** The `massSims` block in a sim's package.json. */
export interface MassSimsMeta {
  title: string;
  gradeBand: string;
  order: number;
  titleFont: TitleFont;
  colors: SimColors;
}

export interface SimInfo {
  name: string;
  description: string;
  meta: MassSimsMeta;
}

export interface GradeBand {
  band: string;
  sims: SimInfo[];
}

function readJsonOrNull(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

/** Build a sim's entry from its folder name and package.json; null when it has no block. */
export function toSimInfo(name: string, pkg: Record<string, unknown>): SimInfo | null {
  const meta = pkg.massSims as MassSimsMeta | undefined;
  if (!meta) return null;
  return { name, description: (pkg.description as string | undefined) ?? "", meta };
}

/** Sort by `order`, then by folder name. */
export function sortSims(sims: SimInfo[]): SimInfo[] {
  return [...sims].sort((a, b) => a.meta.order - b.meta.order || a.name.localeCompare(b.name));
}

/** Group sorted sims by grade band, with the bands in the order they first appear. */
export function groupByBand(sims: SimInfo[]): GradeBand[] {
  const bands: GradeBand[] = [];
  for (const sim of sims) {
    const band = bands.find((b) => b.band === sim.meta.gradeBand);
    if (band) band.sims.push(sim);
    else bands.push({ band: sim.meta.gradeBand, sims: [sim] });
  }
  return bands;
}

/** The sims to list, sorted. Prints a warning for each sim left off for having no block. */
export function discoverSims(): SimInfo[] {
  const rootPkg = readJsonOrNull(join(REPO_ROOT, "package.json"));
  if (!rootPkg) throw new Error("Could not read root package.json");
  const workspaces = (rootPkg.workspaces as string[] | undefined) ?? [];

  const sims: SimInfo[] = [];
  for (const pattern of workspaces) {
    // We only surface `simulations/*` in the user-facing index. `packages/*` are
    // infrastructure (shared library, starter template) and stay out.
    if (pattern !== "simulations/*") continue;
    const dirPath = join(REPO_ROOT, "simulations");
    if (!existsSync(dirPath)) continue;
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkg = readJsonOrNull(join(dirPath, entry.name, "package.json"));
      if (!pkg?.name) continue;
      const sim = toSimInfo(entry.name, pkg);
      if (sim) {
        sims.push(sim);
      } else {
        console.warn(
          `gen-index: simulations/${entry.name}/package.json has no "massSims" block; ` +
            "leaving it off the page.",
        );
      }
    }
  }
  return sortSims(sims);
}

function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return s.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

export function renderHtml(sims: SimInfo[]): string {
  const items =
    sims.length === 0
      ? "      <p><em>No simulations yet.</em></p>"
      : `      <ul>\n${sims
          .map(
            (s) =>
              `        <li>\n          <a href="./${s.name}/index.html">${escapeHtml(s.name)}</a>${
                s.description ? `\n          <p>${escapeHtml(s.description)}</p>` : ""
              }\n        </li>`,
          )
          .join("\n")}\n      </ul>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Mass Sims</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #222; }
      h1 { font-size: 1.75rem; margin-bottom: 0.5rem; }
      .lede { color: #555; margin-top: 0; }
      ul { list-style: none; padding: 0; }
      li { margin: 1rem 0; padding: 1rem; border: 1px solid #ddd; border-radius: 8px; }
      a { font-weight: 600; text-decoration: none; color: #005f99; }
      a:hover { text-decoration: underline; }
      li p { margin: 0.25rem 0 0; color: #555; font-size: 0.9rem; }
      footer { margin-top: 2rem; color: #888; font-size: 0.85rem; }
    </style>
  </head>
  <body>
    <h1>Mass Sims</h1>
    <p class="lede">Educational science simulations. <a href="https://github.com/concord-consortium/mass-sims">Source on GitHub</a>.</p>
${items}
    <footer>Auto-generated from the workspace list in <code>package.json</code>. Run <code>yarn gen-index</code> to regenerate.</footer>
  </body>
</html>
`;
}

function main() {
  const checkMode = process.argv.includes("--check");
  const indexPath = join(REPO_ROOT, "index.html");
  const sims = discoverSims();
  const expected = renderHtml(sims);

  if (checkMode) {
    const actual = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
    if (actual !== expected) {
      console.error("gen-index: index.html is out of date with the workspace list.");
      console.error("           Run `yarn gen-index` to regenerate, then commit the result.");
      process.exit(1);
    }
    console.log("gen-index: index.html is up to date.");
  } else {
    writeFileSync(indexPath, expected);
    console.log(`gen-index: wrote index.html with ${sims.length} simulation(s).`);
  }
}

// Run main() only when executed directly (not when imported by tests).
const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) main();
