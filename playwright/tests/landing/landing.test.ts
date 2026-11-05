import { expect, test } from "@playwright/test";
import { LandingPage } from "../../pages/landing-page";
import { getTopTestUrl } from "../../sims";

// Runs in the `landing` projects (1084 / 1200 / 1920 wide) against the top-test fixture, which
// `yarn build:top-test` builds. See docs/playwright.md.

const SIMS = [
  { name: "bananas", title: "Bananas" },
  { name: "collapse", title: "Collapse!" },
  { name: "noreaster", title: "Nor’easter" },
];

// From landing.scss: the 248px button column, a 24px gap and two 20px gutters beside a sim that
// stretches between its standalone limits, 772 and 1028 (768–1024 plus its 2px border).
const SIM_MIN = 772;
const SIM_MAX = 1028;
const BESIDE_SIM = 248 + 24 + 2 * 20;

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

let landing: LandingPage;

test.beforeEach(({ page }) => {
  landing = new LandingPage(page);
});

test("starts on the first sim, and ?sim= picks another", async () => {
  await landing.goto("/");
  await expect(landing.simButton("bananas")).toHaveAttribute("aria-pressed", "true");

  await landing.goto("/?sim=noreaster");
  await expect(landing.simButton("noreaster")).toHaveAttribute("aria-pressed", "true");
  await expect(landing.simButton("bananas")).toHaveAttribute("aria-pressed", "false");
  await expect(landing.sim.locator(".sim-title")).toHaveText("Nor’easter");
});

test("each button runs its sim in the iframe, in standalone mode", async ({ page }) => {
  await landing.goto("/");
  // Bananas last: it starts selected, and clicking the selected sim changes nothing.
  for (const sim of [...SIMS.slice(1), SIMS[0]]) {
    await landing.simButton(sim.name).click();

    await expect(landing.simButton(sim.name)).toHaveAttribute("aria-pressed", "true");
    await expect(landing.sim.locator(".sim-title")).toHaveText(sim.title);
    // The 2px border: standalone mode survived the trip through the iframe URL.
    await expect(landing.sim.locator(".simulation-frame.standalone")).toBeVisible();
    await expect(landing.shareName).toHaveText(sim.title);
    expect(new URL(page.url()).searchParams.get("sim")).toBe(sim.name);
  }
});

test("buttons sit left of the sim, which stretches between its limits", async ({ page }) => {
  await landing.goto("/");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");

  const buttons = await landing.simButtons.first().boundingBox();
  const frame = await landing.simFrame.boundingBox();
  if (!buttons || !frame) throw new Error("no layout");

  expect(buttons.x + buttons.width).toBeLessThan(frame.x);
  expect(buttons.y).toBeLessThan(frame.y + frame.height);
  expect(await landing.scrollsSideways()).toBe(false);
  const expected = Math.min(SIM_MAX, Math.max(SIM_MIN, viewport.width - BESIDE_SIM));
  expect(frame.width).toBe(expected);
  expect(frame.height).toBe(566);
  // The sim fills the iframe exactly: no clipping and no scrolling inside it.
  await expect
    .poll(() =>
      landing.sim
        .locator("html")
        .evaluate((el) => [el.scrollWidth, el.scrollHeight, el.clientWidth, el.clientHeight]),
    )
    .toEqual([expected, 566, expected, 566]);
});

test("Tab goes logos, sim buttons, the sim, the share row, the footer", async ({ page }) => {
  await landing.goto("/");
  const focused = () =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      return el.className.split(" ")[0] + (el.dataset.sim ? `:${el.dataset.sim}` : "");
    });

  const order: string[] = [];
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    order.push(await focused());
  }
  expect(order).toEqual([
    "logo-link",
    "logo-link",
    "sim-button:bananas",
    "sim-button:collapse",
    "sim-button:noreaster",
  ]);

  // Next is the sim itself; back from the share row also lands in it.
  await page.keyboard.press("Tab");
  expect(await focused()).toBe("sim-frame");
  await landing.shareButton("open").focus();
  await page.keyboard.press("Shift+Tab");
  expect(await focused()).toBe("sim-frame");

  // After the share row come the footer links.
  await landing.shareButton("copy-embed").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveText("Terms of Use");
});

// The version deploy is opened at its index.html: `serve` lists a folder whose name has dots in it
// (like a real tag) instead of serving its index.html. That also covers the page's own address
// ending in index.html.
for (const deploy of [
  { path: "/", page: "", version: null },
  { path: "/version/v0.0.0-test/", page: "index.html", version: "MassSims v0.0.0-test" },
  { path: "/branch/test-branch/", page: "", version: "MassSims (branch test-branch)" },
]) {
  test.describe(`deployed at ${deploy.path}`, () => {
    const collapseUrl = getTopTestUrl(`${deploy.path}collapse/index.html`);

    test.beforeEach(async () => {
      await landing.goto(`${deploy.path}${deploy.page}?sim=collapse`);
    });

    test("loads the sim from the same deploy path", async () => {
      await expect(landing.sim.locator(".sim-title")).toHaveText("Collapse!");
      expect(await landing.simFrameUrl()).toBe(`${collapseUrl}?standalone=true`);
    });

    test("Copy URL copies that deployment's sim URL", async () => {
      await landing.shareButton("copy-url").click();

      await expect(landing.shareButton("copy-url")).toContainText("Copied");
      await expect(landing.liveRegion).toHaveText("Collapse! URL copied");
      expect(await landing.clipboardText()).toBe(collapseUrl);
    });

    test("Copy embed code copies an iframe for that deployment's sim", async () => {
      await landing.shareButton("copy-embed").click();

      await expect(landing.liveRegion).toHaveText("Collapse! embed code copied");
      expect(await landing.clipboardText()).toBe(
        `<iframe src="${collapseUrl}" width="1024" height="562" frameborder="0" ` +
          'allowfullscreen title="Collapse!"></iframe>',
      );
    });

    test("the footer shows which build this is", async () => {
      if (deploy.version === null) {
        await expect(landing.footerVersion).toBeHidden();
      } else {
        await expect(landing.footerVersion).toHaveText(deploy.version);
      }
    });
  });
}
