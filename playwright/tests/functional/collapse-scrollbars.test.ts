import { expect, test } from "@playwright/test";
import { CollapsePage } from "../../pages/collapse-page";

// Collapse with scrollbars that take width, as on Windows. Playwright hides scrollbars by default,
// which is a browser launch option, so these tests need a file of their own.

test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

let collapse: CollapsePage;

test.beforeEach(async ({ page }) => {
  collapse = new CollapsePage(page);
  await collapse.goto();
  // The same width on any OS: 17px, the widest in common use (Firefox on Windows).
  await page.addStyleTag({ content: "::-webkit-scrollbar { width: 17px; }" });
});

test("Compare Trials: a column with a scrollbar fits its values without a sideways scroll", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.endsWith("-767"), "checked at the narrowest width");
  // Trial B, limestone and wet, collapses by year 0, so its Rock column shows "collapsed".
  await collapse.selectTrial("B");
  for (const years of [200000, 150000, 100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 0]) {
    await collapse.sampleAt(years);
  }
  await collapse.compareButton.click();
  await expect(collapse.compareRow("B", 0)).toContainText("collapsed");
  const scroller = collapse.compareColumn("B").locator(".collapse-compare-rows");
  expect(await scroller.evaluate((el: HTMLElement) => el.offsetWidth - el.clientWidth)).toBe(17);
  const clipped = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        ".collapse-compare .collapse-rows td, .collapse-compare tfoot th, .collapse-compare tfoot td",
      ),
    )
      .filter((cell) => cell.scrollWidth > cell.clientWidth + 0.5)
      .map((cell) => cell.textContent),
  );
  expect(clipped).toEqual([]);
  const overflow = await collapse.compareGrid.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBe(0);
});
