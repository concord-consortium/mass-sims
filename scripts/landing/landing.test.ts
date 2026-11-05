// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type MassSimsMeta, renderHtml, type SimInfo, sortSims, toSimInfo } from "../gen-index";

const SCRIPT = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "landing.js"), "utf8");

function sim(name: string, title: string, order: number, surface: string): SimInfo {
  const meta: MassSimsMeta = {
    title,
    gradeBand: "Grades 6-8",
    order,
    titleFont: { family: "Slackey" },
    colors: {
      surface,
      text: "#333",
      border: "#555",
      hover: "#f0f0f0",
      active: "#d0d0d0",
      selectedText: "#fff",
    },
  };
  const info = toSimInfo(name, { name, massSims: meta });
  if (!info) throw new Error("expected a SimInfo");
  return info;
}

const SIMS = sortSims([
  sim("bananas", "Bananas", 1, "#fffdf2"),
  sim("collapse", "Collapse!", 2, "#f0faf4"),
  sim("noreaster", "Nor’easter", 3, "#f0f6fe"),
]);

const writeText = vi.fn<(text: string) => Promise<void>>();

/** Put the generated page at `path` (with its query) and run landing.js on it. */
function load(path: string, sims: SimInfo[] = SIMS) {
  window.history.replaceState(null, "", path);
  const parsed = new DOMParser().parseFromString(renderHtml(sims), "text/html");
  // Run the script ourselves, once, rather than relying on the environment to run inline scripts.
  for (const script of parsed.querySelectorAll("script:not([type])")) script.remove();
  document.replaceChild(
    document.importNode(parsed.documentElement, true),
    document.documentElement,
  );
  new Function(SCRIPT)();
}

const $ = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector(selector) as T;
const button = (name: string) => $<HTMLButtonElement>(`.sim-button[data-sim="${name}"]`);
const pressed = () =>
  [...document.querySelectorAll(".sim-button[aria-pressed='true']")].map(
    (b) => (b as HTMLElement).dataset.sim,
  );
const frame = () => $<HTMLIFrameElement>(".sim-frame");
const label = (id: string) => $(`#${id} .share-label`).textContent;
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  window.open = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("selecting a sim", () => {
  it("starts on the first sim when the URL names none", () => {
    load("/index.html");

    expect(pressed()).toEqual(["bananas"]);
    expect(frame().getAttribute("src")).toBe("./bananas/index.html?standalone=true");
  });

  it("starts on the sim named by ?sim=", () => {
    load("/index.html?sim=collapse");

    expect(pressed()).toEqual(["collapse"]);
    expect(frame().getAttribute("src")).toBe("./collapse/index.html?standalone=true");
    expect(frame().title).toBe("Collapse! simulation");
    expect($("#share-name").textContent).toBe("Collapse!");
    expect($(".sim-panel").style.getPropertyValue("--sim-surface")).toBe("#f0faf4");
  });

  it("ignores an unknown ?sim=", () => {
    load("/index.html?sim=lumps");

    expect(pressed()).toEqual(["bananas"]);
  });

  it("switches the sim, its colors and the URL on click", () => {
    load("/index.html");

    button("noreaster").click();

    expect(pressed()).toEqual(["noreaster"]);
    expect(frame().getAttribute("src")).toBe("./noreaster/index.html?standalone=true");
    expect(frame().title).toBe("Nor’easter simulation");
    expect($("#share-name").textContent).toBe("Nor’easter");
    expect($(".sim-panel").style.getPropertyValue("--sim-surface")).toBe("#f0f6fe");
    expect(window.location.search).toBe("?sim=noreaster");
  });

  it("leaves the URL alone when the selected sim is clicked", () => {
    load("/index.html");

    button("bananas").click();

    expect(window.location.search).toBe("");
  });
});

describe("the share row", () => {
  it("opens the selected sim in a new tab", () => {
    load("/branch/test-branch/index.html?sim=collapse");

    $<HTMLButtonElement>("#share-open").click();

    expect(window.open).toHaveBeenCalledWith(
      `${window.location.origin}/branch/test-branch/collapse/index.html`,
      "_blank",
      "noopener",
    );
  });

  it("copies the sim's URL for the deployment the page is on, and announces it", async () => {
    load("/version/v0.0.0-test/index.html");

    $<HTMLButtonElement>("#share-copy-url").click();

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/version/v0.0.0-test/bananas/index.html`,
    );
    await vi.waitFor(() => expect(label("share-copy-url")).toBe("Copied"));
    await nextFrame();
    expect($("[aria-live]").textContent).toBe("Bananas URL copied");
  });

  it("copies the embed code, with the sim's title", async () => {
    load("/index.html?sim=collapse");

    $<HTMLButtonElement>("#share-copy-embed").click();

    expect(writeText).toHaveBeenCalledWith(
      `<iframe src="${window.location.origin}/collapse/index.html" width="1024" height="562" ` +
        'frameborder="0" allowfullscreen title="Collapse!"></iframe>',
    );
    await vi.waitFor(() => expect(label("share-copy-embed")).toBe("Copied"));
    await nextFrame();
    expect($("[aria-live]").textContent).toBe("Collapse! embed code copied");
  });

  it("escapes the title in the embed code", () => {
    load("/index.html", [sim("rock", 'Rock "n" <Roll> & more', 1, "#fff")]);

    $<HTMLButtonElement>("#share-copy-embed").click();

    expect(writeText.mock.calls[0][0]).toContain(
      'title="Rock &quot;n&quot; &lt;Roll&gt; &amp; more"',
    );
  });

  it("falls back to a hidden textarea when the clipboard refuses", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    load("/index.html");

    $<HTMLButtonElement>("#share-copy-url").click();

    await vi.waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
    expect(document.querySelector("textarea")).toBeNull();
    await vi.waitFor(() => expect(label("share-copy-url")).toBe("Copied"));
  });

  it("puts the label back after 1.4 seconds", async () => {
    load("/index.html");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    $<HTMLButtonElement>("#share-copy-url").click();
    // Let the clipboard promise settle (vi.waitFor would move the fake clock).
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(label("share-copy-url")).toBe("Copied");
    vi.advanceTimersByTime(1399);
    expect(label("share-copy-url")).toBe("Copied");
    vi.advanceTimersByTime(1);

    expect(label("share-copy-url")).toBe("Copy URL");
  });
});

describe("the footer", () => {
  it.each([
    ["/index.html", null],
    ["/", null],
    ["/version/v0.0.0-test/index.html", "MassSims v0.0.0-test"],
    ["/version/v0.0.0-test/", "MassSims v0.0.0-test"],
    ["/branch/test-branch/index.html", "MassSims (branch test-branch)"],
  ])("at %s shows version %s", (path, expected) => {
    load(path);

    const version = $(".footer-version");
    expect(version.hidden).toBe(expected === null);
    expect($(".footer-version-sep").hidden).toBe(expected === null);
    if (expected) expect(version.textContent).toBe(expected);
  });

  it("shows this year", () => {
    load("/index.html");

    expect($(".footer-year").textContent).toBe(String(new Date().getFullYear()));
  });
});
