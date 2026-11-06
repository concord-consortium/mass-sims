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

  it("refuses a missing field, naming the sim and the field", () => {
    expect(() => sim("x", { title: "" })).toThrow(
      "simulations/x/package.json massSims.title must be a non-empty string",
    );
  });

  // Colors, font names and lengths go into CSS unescaped, so anything that could end a
  // declaration or a quoted name is refused.
  it.each([
    ["colors.surface", { colors: { ...meta({}).colors, surface: "red" } }],
    ["colors.hover", { colors: { ...meta({}).colors, hover: "#fff;background:url(x)" } }],
    ["titleFont.family", { titleFont: { family: "Slackey';}body{color:red" } }],
    ["titleFont.letterSpacing", { titleFont: { family: "Slackey", letterSpacing: "2px;x:y" } }],
  ])("refuses a bad %s", (field, overrides) => {
    expect(() => sim("x", overrides as Partial<MassSimsMeta>)).toThrow(`massSims.${field} must be`);
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

describe("renderHtml", () => {
  const sims = sortSims([
    sim("bananas", { title: "Bananas", order: 1 }),
    sim("collapse", {
      title: "Collapse!",
      order: 2,
      titleFont: { family: "Fontdiner Swanky", letterSpacing: "2px", offsetY: "2px" },
    }),
    sim("lumps", { title: "Mystery Lumps", gradeBand: "Grades 3-5", order: 0 }),
  ]);
  const html = renderHtml(sims);

  function simsJsonText(page: string): string {
    const match = page.match(/<script type="application\/json" id="sims">([\s\S]*?)<\/script>/);
    if (!match) throw new Error("no sims JSON block");
    return match[1];
  }

  function simsJson(page: string): { name: string; title: string }[] {
    return JSON.parse(simsJsonText(page));
  }

  it("selects the first sim in order: its button, iframe and share name", () => {
    expect(html).toContain('data-sim="lumps" aria-pressed="true"');
    expect(html).toContain('data-sim="bananas" aria-pressed="false"');
    expect(html).toContain(
      '<iframe class="sim-frame" src="./lumps/index.html?standalone=true" title="Mystery Lumps simulation">',
    );
    expect(html).toContain('<span class="share-name" id="share-name">Mystery Lumps</span>');
  });

  it("groups the buttons into labelled bands, in order", () => {
    expect(html).toContain('role="group" aria-labelledby="band-0"');
    expect(html).toContain('<div class="band-label" id="band-0">Grades 3-5</div>');
    expect(html).toContain('<div class="band-label" id="band-1">Grades 6-8</div>');
    expect(html.indexOf('data-sim="bananas"')).toBeLessThan(html.indexOf('data-sim="collapse"'));
  });

  it("puts the sim's font and colors on its button", () => {
    expect(html).toContain(
      "--sim-font:'Fontdiner Swanky';--sim-letter-spacing:2px;--sim-offset-y:2px",
    );
    expect(html).toContain("--sim-surface:#fff;--sim-text:#333;");
  });

  it("loads each title font once from Google Fonts", () => {
    expect(html).toContain(
      "https://fonts.googleapis.com/css2?family=Lato:wght@100;300;700;900&amp;family=Slackey" +
        "&amp;family=Fontdiner+Swanky&amp;display=swap",
    );
  });

  it("inlines the stylesheet, the logos and the share icons", () => {
    expect(html).toContain(".sim-button {");
    expect(html).toContain('src="data:image/svg+xml;base64,');
    expect(html.match(/<svg aria-hidden="true"/g)).toHaveLength(3);
    expect(html).not.toContain("{{");
  });

  // The sim stretches between its standalone limits (768–1024 + its 2px border each side) beside
  // the 248px button column; below 248 + 24 + 772 + 2 × 20 the page scrolls sideways.
  it("sizes the layout from the sim's standalone limits", () => {
    expect(html).toContain("grid-template-columns: 248px minmax(772px, 1028px);");
    expect(html).toContain("min-width: 1084px;");
    expect(html).toContain("max-width: 1340px;");
  });

  it("carries the sims as JSON for the page script", () => {
    expect(simsJson(html).map((s) => s.name)).toEqual(["lumps", "bananas", "collapse"]);
  });

  describe("with a title that needs escaping", () => {
    const title = `Rock "n" 'Roll' & <b>it</b></script><script>alert(1)</script>`;
    const tricky = renderHtml([sim("tricky", { title })]);

    it("escapes it in HTML text and attributes", () => {
      const escaped =
        "Rock &quot;n&quot; &#39;Roll&#39; &amp; &lt;b&gt;it&lt;/b&gt;&lt;/script&gt;" +
        "&lt;script&gt;alert(1)&lt;/script&gt;";
      expect(tricky).toContain(`<span class="sim-button-label">${escaped}</span>`);
      expect(tricky).toContain(`title="${escaped} simulation"`);
    });

    it("never closes a script element early", () => {
      // No raw <, > or & inside the JSON block, so no value can end it or open a comment.
      expect(simsJsonText(tricky)).not.toMatch(/[<>&]/);
      // The only </script> tags on the page close the JSON block and the page script.
      expect(tricky.split("</script>")).toHaveLength(3);
    });

    it("survives JSON.parse unchanged", () => {
      expect(simsJson(tricky)[0].title).toBe(title);
    });
  });

  it("refuses to render a page with no sims", () => {
    expect(() => renderHtml([])).toThrow("nothing to list");
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
