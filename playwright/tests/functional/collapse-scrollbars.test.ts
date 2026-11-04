import { expect, test } from "@playwright/test";
import { CollapsePage } from "../../pages/collapse-page";

// Collapse with scrollbars that take width, as on Windows. Playwright hides scrollbars by default,
// which is a browser launch option, so these tests need a file of their own.

test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

let collapse: CollapsePage;

test.beforeEach(async ({ page }) => {
  collapse = new CollapsePage(page);
  await collapse.goto();
  // The same width on any OS: 17px, the widest in common use (Firefox on Windows). The page itself
  // does not scroll: the standalone frame's border makes it a few pixels larger than the window,
  // and the page's scrollbar would cover the frame's right edge.
  await page.addStyleTag({
    content: "::-webkit-scrollbar { width: 17px; } html { overflow: hidden; }",
  });
});

test("Compare Trials: a column with a scrollbar fits its values without a sideways scroll", async () => {
  test.skip(!test.info().project.name.endsWith("-767"), "checked at the narrowest width");
  await collapse.selectTrial("B");
  for (const years of [200000, 150000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 0]) {
    await collapse.sampleAt(years);
  }
  await collapse.compareButton.click();
  const scroller = collapse.compareColumn("B").locator(".collapse-compare-rows");
  expect(await scroller.evaluate((el: HTMLElement) => el.offsetWidth - el.clientWidth)).toBe(17);
  const { checked, clipped } = await collapse.compareClippedCells();
  expect(checked).toBeGreaterThan(0);
  expect(clipped).toEqual([]);
  const overflow = await collapse.compareGrid.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBe(0);
  // Column B's table is the narrowest the view allows, which the hidden-scrollbar tests never reach.
  await expect.poll(() => collapse.compareHeadingMisses()).toEqual([]);
});
