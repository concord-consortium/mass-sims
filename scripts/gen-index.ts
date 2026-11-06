#!/usr/bin/env tsx
//
// scripts/gen-index.ts — generates the root index.html, the Mass Sims landing page.
//
// Reads the `workspaces` array from the root package.json, discovers every directory
// inside `simulations/*` that has its own package.json, and writes one self-contained
// HTML page: a button per sim, grouped by grade band, and the selected sim running in
// an iframe. Each sim's `massSims` block in its package.json gives its display title,
// grade band, order, title font and colors. A sim without one is left off the page,
// and the script prints a warning.
//
// The page is built from scripts/landing/: the markup template, the SCSS (compiled
// here), the page script, and the share icons. The stylesheet, the script and every
// SVG are inlined, so the deploy still copies a single file.
//
// Modes:
//   yarn gen-index            → regenerate index.html (overwrites)
//   yarn gen-index --check    → verify index.html matches what would be generated;
//                               exits non-zero with a hint if it's stale
//
// CI runs --check on every push so the committed index.html never drifts from the
// workspace list. Developers run `yarn gen-index` (no flag) after adding/removing a
// sim, or changing scripts/landing/, then commit the regenerated index.html.
//
// Note: this script ignores `packages/*` workspaces (shared library, starter template);
// only `simulations/*` are user-facing and listed in the index.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as sass from "sass";
import { FRAME_HEIGHT, TARGET_WIDTHS } from "../packages/shared/src/layout/target-widths";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const LANDING_DIR = join(SCRIPT_DIR, "landing");
const BRANDING_DIR = join(REPO_ROOT, "packages", "shared", "src", "assets", "branding");

// The embed code's iframe size: the standalone width and the frame height.
const EMBED_WIDTH = TARGET_WIDTHS.find((w) => w.token === "standalone")?.px;
if (EMBED_WIDTH === undefined) throw new Error('gen-index: no "standalone" entry in TARGET_WIDTHS');

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
  meta: MassSimsMeta;
}

export interface GradeBand {
  band: string;
  sims: SimInfo[];
}

const COLOR_KEYS = ["surface", "text", "border", "hover", "active", "selectedText"] as const;

// Values that end up in CSS are checked, not escaped: anything outside these shapes is refused.
const COLOR_PATTERN = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
const FONT_FAMILY_PATTERN = /^[A-Za-z0-9 ]+$/;
const LENGTH_PATTERN = /^-?\d+(\.\d+)?px$/;

function readJsonOrNull(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

/** Throw a clear error naming the sim and the field unless the block has the expected shape. */
function validateMeta(name: string, meta: MassSimsMeta): void {
  const fail = (field: string, problem: string) => {
    throw new Error(`gen-index: simulations/${name}/package.json massSims.${field} ${problem}`);
  };
  if (typeof meta.title !== "string" || !meta.title) fail("title", "must be a non-empty string");
  if (typeof meta.gradeBand !== "string" || !meta.gradeBand) {
    fail("gradeBand", "must be a non-empty string");
  }
  if (typeof meta.order !== "number") fail("order", "must be a number");

  const font = meta.titleFont;
  if (!font || typeof font.family !== "string" || !FONT_FAMILY_PATTERN.test(font.family)) {
    fail("titleFont.family", "must be a font name of letters, digits and spaces");
  }
  for (const key of ["letterSpacing", "offsetY", "size"] as const) {
    const value = font[key];
    if (value !== undefined && !LENGTH_PATTERN.test(value)) {
      fail(`titleFont.${key}`, `must be a px length like "2px" (got ${JSON.stringify(value)})`);
    }
  }

  for (const key of COLOR_KEYS) {
    const value = meta.colors?.[key];
    if (typeof value !== "string" || !COLOR_PATTERN.test(value)) {
      fail(`colors.${key}`, `must be a hex color like "#f0faf4" (got ${JSON.stringify(value)})`);
    }
  }
}

/** Build a sim's entry from its folder name and package.json; null when it has no block. */
export function toSimInfo(name: string, pkg: Record<string, unknown>): SimInfo | null {
  const meta = pkg.massSims as MassSimsMeta | undefined;
  if (!meta) return null;
  validateMeta(name, meta);
  return { name, meta };
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

/** For HTML text and attribute values. */
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

/**
 * For JSON inside a <script> element, where the browser does not decode HTML entities. The JSON
 * escapes keep a value from closing the element early, and JSON.parse() turns them back.
 */
function escapeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

/**
 * The --sim-* color properties, for a `style` attribute. Values are validated hex colors. The
 * panel's share buttons have no selected state, so the panel leaves out --sim-selected-text.
 */
function colorVars(colors: SimColors, withSelectedText = true): string {
  return [
    `--sim-surface:${colors.surface}`,
    `--sim-text:${colors.text}`,
    `--sim-border:${colors.border}`,
    `--sim-hover:${colors.hover}`,
    `--sim-active:${colors.active}`,
    withSelectedText && `--sim-selected-text:${colors.selectedText}`,
  ]
    .filter(Boolean)
    .join(";");
}

/** The wordmark's --sim-* font properties. Values are validated names and px lengths. */
function fontVars(font: TitleFont): string {
  return [
    `--sim-font:'${font.family}'`,
    font.size && `--sim-font-size:${font.size}`,
    font.letterSpacing && `--sim-letter-spacing:${font.letterSpacing}`,
    font.offsetY && `--sim-offset-y:${font.offsetY}`,
  ]
    .filter(Boolean)
    .join(";");
}

/** One stylesheet link for Lato (the page-text fallback) and every sim's title font. */
function googleFontsUrl(sims: SimInfo[]): string {
  const families = [...new Set(sims.map((s) => s.meta.titleFont.family))];
  const params = ["family=Lato:wght@100;300;700;900"]
    .concat(families.map((f) => `family=${f.replaceAll(" ", "+")}`))
    .concat("display=swap");
  return `https://fonts.googleapis.com/css2?${params.join("&")}`;
}

function simButton(sim: SimInfo, selected: boolean): string {
  const style = `${colorVars(sim.meta.colors)};${fontVars(sim.meta.titleFont)}`;
  return (
    `<button type="button" class="sim-button" data-sim="${escapeHtml(sim.name)}" ` +
    `aria-pressed="${selected}" style="${style}">` +
    `<span class="sim-button-label">${escapeHtml(sim.meta.title)}</span></button>`
  );
}

function simButtons(sims: SimInfo[]): string {
  const selected = sims[0];
  return groupByBand(sims)
    .map((band, i) =>
      [
        `          <div class="sim-band" role="group" aria-labelledby="band-${i}">`,
        `            <div class="band-label" id="band-${i}">${escapeHtml(band.band)}</div>`,
        ...band.sims.map((s) => `            ${simButton(s, s === selected)}`),
        "          </div>",
      ].join("\n"),
    )
    .join("\n");
}

function svgDataUri(path: string): string {
  return `data:image/svg+xml;base64,${readFileSync(path).toString("base64")}`;
}

function readIcon(name: string): string {
  return readFileSync(join(LANDING_DIR, "icons", `${name}.svg`), "utf8").trim();
}

/** Fill each {{placeholder}}; throw if the template names one that has no value. */
function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`gen-index: no value for {{${key}}} in the template`);
    return value;
  });
}

export function renderHtml(sims: SimInfo[]): string {
  if (sims.length === 0) {
    throw new Error('gen-index: no sim has a "massSims" block, so there is nothing to list.');
  }
  const first = sims[0];
  const css = sass.compile(join(LANDING_DIR, "landing.scss"), { style: "expanded" }).css;
  const simsData = sims.map((s) => ({ name: s.name, title: s.meta.title, colors: s.meta.colors }));
  // The file's header comment is for its readers, not the page's, so it is left out.
  const landingJs = readFileSync(join(LANDING_DIR, "landing.js"), "utf8")
    .replace(/^(\/\/.*\n)+\s*/, "")
    .trimEnd();
  if (/<\/script/i.test(landingJs)) {
    throw new Error("gen-index: landing.js must not contain </script, which would end the element");
  }

  return fillTemplate(readFileSync(join(LANDING_DIR, "index.template.html"), "utf8"), {
    googleFontsUrl: escapeHtml(googleFontsUrl(sims)),
    css,
    ccLogo: svgDataUri(join(BRANDING_DIR, "cc-logo.svg")),
    deseLogo: svgDataUri(join(BRANDING_DIR, "dese-mass-logo.svg")),
    simButtons: simButtons(sims),
    panelStyle: colorVars(first.meta.colors, false),
    iframeSrc: `./${escapeHtml(first.name)}/index.html?standalone=true`,
    iframeTitle: `${escapeHtml(first.meta.title)} simulation`,
    simTitle: escapeHtml(first.meta.title),
    embedWidth: String(EMBED_WIDTH),
    embedHeight: String(FRAME_HEIGHT),
    openIcon: readIcon("open-in-new-tab"),
    copyUrlIcon: readIcon("copy-url"),
    copyEmbedIcon: readIcon("copy-embed-code"),
    simsJson: escapeJsonForScript(simsData),
    landingJs,
  });
}

function main() {
  const checkMode = process.argv.includes("--check");
  const indexPath = join(REPO_ROOT, "index.html");
  const sims = discoverSims();
  const expected = renderHtml(sims);

  if (checkMode) {
    const actual = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
    if (actual !== expected) {
      console.error("gen-index: index.html is out of date with the sims or scripts/landing/.");
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
