import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  discoverSims,
  groupByBand,
  type MassSimsMeta,
  renderHtml,
  type SimInfo,
  sortSims,
  toSimInfo,
} from "./gen-index";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function meta(overrides: Partial<MassSimsMeta>): MassSimsMeta {
  return {
    title: "Sim",
    gradeBand: "Grades 6-8",
    order: 1,
    titleFont: { family: "Slackey" },
    colors: {
      surface: "#fff",
      text: "#333",
      border: "#555",
      hover: "#f0f0f0",
      active: "#d0d0d0",
      selectedText: "#fff",
    },
    ...overrides,
  };
}

function sim(name: string, overrides: Partial<MassSimsMeta>): SimInfo {
  const info = toSimInfo(name, { name, massSims: meta(overrides) });
  if (!info) throw new Error("expected a SimInfo");
  return info;
}

describe("toSimInfo", () => {
  it("reads the massSims block", () => {
    const info = sim("collapse", { title: "Collapse!", order: 2 });

    expect(info.meta.title).toBe("Collapse!");
    expect(info.meta.order).toBe(2);
  });

  it("skips a sim with no block", () => {
    expect(toSimInfo("new-sim", { name: "new-sim", description: "A sim." })).toBeNull();
  });
});

describe("sortSims", () => {
  it("sorts by order, then by folder name", () => {
    const sorted = sortSims([
      sim("c", { order: 2 }),
      sim("b", { order: 1 }),
      sim("a", { order: 2 }),
    ]);

    expect(sorted.map((s) => s.name)).toEqual(["b", "a", "c"]);
  });
});

describe("groupByBand", () => {
  it("keeps the bands in the order they first appear", () => {
    const bands = groupByBand(
      sortSims([
        sim("bananas", { gradeBand: "Grades 6-8", order: 1 }),
        sim("lumps", { gradeBand: "Grades 3-5", order: 0 }),
        sim("collapse", { gradeBand: "Grades 6-8", order: 2 }),
      ]),
    );

    expect(bands.map((b) => [b.band, b.sims.map((s) => s.name)])).toEqual([
      ["Grades 3-5", ["lumps"]],
      ["Grades 6-8", ["bananas", "collapse"]],
    ]);
  });
});

describe("the listed sims", () => {
  // The colors duplicate values from each sim's theme.scss. This catches a palette change that
  // forgets the landing page.
  it("take each color from their own theme.scss", () => {
    for (const s of discoverSims()) {
      const themePath = join(REPO_ROOT, "simulations", s.name, "src", "theme.scss");
      const theme = readFileSync(themePath, "utf8");
      for (const [key, value] of Object.entries(s.meta.colors)) {
        // Not followed by another hex digit, so "#fff" does not match inside "#fffdf2".
        const pattern = new RegExp(`${value}(?![0-9a-f])`, "i");
        expect(pattern.test(theme), `${s.name} colors.${key} ${value} in ${themePath}`).toBe(true);
      }
    }
  });
});

describe("the committed index.html", () => {
  // The same equality `--check` enforces in CI.
  it("is up to date with the sims", () => {
    const committed = readFileSync(join(REPO_ROOT, "index.html"), "utf8");

    expect(committed).toBe(renderHtml(discoverSims()));
  });
});
