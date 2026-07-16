import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FRAME_HEIGHT, TARGET_WIDTHS } from "../packages/shared/src/layout/target-widths";
import { renderScss } from "./gen-widths";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH = join(
  REPO_ROOT,
  "packages",
  "shared",
  "src",
  "styles",
  "_widths.generated.scss",
);

describe("renderScss", () => {
  it("emits a Sass variable per target width, named from its token", () => {
    const out = renderScss(562, [
      { token: "ap-full", px: 1044 },
      { token: "ap-2col-shown", px: 767 },
    ]);

    expect(out).toContain("$frame-width-ap-full:");
    expect(out).toContain("1044px;");
    expect(out).toContain("$frame-width-ap-2col-shown:");
    expect(out).toContain("767px;");
  });

  it("emits the frame height", () => {
    expect(renderScss(562, [])).toContain("562px;");
  });

  it("warns that the file is generated, so nobody hand-edits it", () => {
    expect(renderScss(562, [])).toContain("DO NOT EDIT");
  });

  it("refuses to emit two widths that share a token", () => {
    expect(() =>
      renderScss(562, [
        { token: "ap-full", px: 1044 },
        { token: "ap-full", px: 989 },
      ]),
    ).toThrow(/Duplicate token\(s\) in TARGET_WIDTHS: ap-full/);
  });

  it("names every duplicated token, not just the first", () => {
    expect(() =>
      renderScss(562, [
        { token: "a", px: 1 },
        { token: "a", px: 2 },
        { token: "b", px: 3 },
        { token: "b", px: 4 },
      ]),
    ).toThrow(/a, b/);
  });
});

describe("the committed _widths.generated.scss", () => {
  // The same equality `--check` enforces in CI. Having it here too means a stale generated file
  // fails locally on `yarn test:scripts`, before it ever reaches a push.
  it("is up to date with target-widths.ts", () => {
    const committed = readFileSync(OUTPUT_PATH, "utf8");

    expect(committed).toBe(renderScss(FRAME_HEIGHT, TARGET_WIDTHS));
  });

  it("declares every width the SCSS consumers actually reference", () => {
    // simulation-frame.scss reads these by name; a renamed token would break the build, but a
    // *missing* one would only break at use-site, so pin the contract here.
    const committed = readFileSync(OUTPUT_PATH, "utf8");

    for (const name of [
      "$frame-height",
      "$frame-width-ap-full",
      "$frame-width-standalone",
      "$frame-width-ap-2col-hidden",
      "$frame-width-ap-2col-shown",
    ]) {
      expect(committed).toContain(`${name}:`);
    }
  });
});
