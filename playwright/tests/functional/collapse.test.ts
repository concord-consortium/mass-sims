import { expect, test } from "@playwright/test";
import { CollapsePage } from "../../pages/collapse-page";

// Collapse functional spec: runs once per target width. Covers the timeline's pointer behavior and
// the data table's keyboard path and layout with the real layout and real input, which the jsdom
// tests can only approximate.

let collapse: CollapsePage;

test.beforeEach(async ({ page }) => {
  collapse = new CollapsePage(page);
  await collapse.goto();
});

test.describe("Timeline pointer input", () => {
  test("pressing a landmark's dot snaps to that value and focuses the slider", async ({ page }) => {
    // Stops 0, 1, 4, and 5 (200,000 / 100,000 / 20 / 0) are also landable values.
    for (const [stop, value] of [
      [1, "100000"],
      [4, "20"],
      [5, "0"],
      [0, "200000"],
    ] as const) {
      const dot = await collapse.stopDotCenter(stop);
      await page.mouse.click(dot.x, dot.y);
      await expect(collapse.timelineSlider).toHaveAttribute("aria-valuenow", value);
    }
    await expect(collapse.timelineSlider).toBeFocused();
    await expect(collapse.timelineTrack).not.toHaveClass(/\bdragging\b/);
  });

  test("pressing a landmark's icon or label snaps to that value", async ({ page }) => {
    const track = await collapse.timelineTrack.boundingBox();
    if (!track) throw new Error("track not found");
    // The museum (20) and collapse (0) icons are the tallest, so their tops are the highest press
    // points on the timeline.
    for (const [stop, value] of [
      [4, "20"],
      [5, "0"],
    ] as const) {
      // Back to 200,000 first, so the flag is at the far left and not over the icon.
      await collapse.timelineSlider.focus();
      await page.keyboard.press("Home");
      const art = await collapse.stopPartBox(stop, "art");
      const y = art.y + 2;
      expect(y - track.y).toBeLessThan(11);
      await page.mouse.click(art.x + art.width / 2, y);
      await expect(collapse.timelineSlider).toHaveAttribute("aria-valuenow", value);
    }
    const label = await collapse.stopPartBox(1, "label");
    await page.mouse.click(label.x + label.width / 2, label.y + label.height / 2);
    await expect(collapse.timelineSlider).toHaveAttribute("aria-valuenow", "100000");
  });

  test("pressing the flag off center keeps the value; dragging moves the handle, not the pointer", async ({
    page,
  }) => {
    // 500, in the dense 4,600 → 20 stretch, where neighboring values are closest together.
    await collapse.timelineSlider.focus();
    await page.keyboard.press("End");
    for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowLeft");
    await expect(collapse.timelineSlider).toHaveAttribute("aria-valuenow", "500");

    const flag = await collapse.timelineSlider.boundingBox();
    if (!flag) throw new Error("flag not found");
    const grab = { x: flag.x + 8, y: flag.y + flag.height / 2 };
    const offset = grab.x - (await collapse.handleX());
    expect(Math.abs(offset)).toBeGreaterThan(60);

    await page.mouse.move(grab.x, grab.y);
    await page.mouse.down();
    await expect(collapse.timelineTrack).toHaveClass(/\bdragging\b/);
    await page.mouse.move(grab.x + 1, grab.y);
    await expect(collapse.timelineSlider).toHaveAttribute("aria-valuenow", "500");

    // Drag so the handle (pointer minus the grab offset) lands on the 20 dot.
    const dot20 = await collapse.stopDotCenter(4);
    await page.mouse.move(dot20.x + offset, grab.y, { steps: 5 });
    await expect(collapse.timelineSlider).toHaveAttribute("aria-valuenow", "20");
    await page.mouse.up();
    await expect(collapse.timelineTrack).not.toHaveClass(/\bdragging\b/);
  });

  test("pressing the flag focuses the slider, so the arrow keys work at once", async ({ page }) => {
    await collapse.laterButton.click();
    await expect(collapse.laterButton).toBeFocused();
    await expect(collapse.timelineSlider).toHaveAttribute("aria-valuenow", "150000");

    const flag = await collapse.timelineSlider.boundingBox();
    if (!flag) throw new Error("flag not found");
    await page.mouse.click(flag.x + flag.width / 2, flag.y + flag.height / 2);
    await expect(collapse.timelineSlider).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(collapse.timelineSlider).toHaveAttribute("aria-valuenow", "100000");
  });

  test("a right-click on the stops changes nothing", async ({ page }) => {
    const dot = await collapse.stopDotCenter(1);
    await page.mouse.click(dot.x, dot.y, { button: "right" });
    await expect(collapse.timelineSlider).toHaveAttribute("aria-valuenow", "200000");
    await expect(collapse.timelineTrack).not.toHaveClass(/\bdragging\b/);
  });
});

test.describe("Data table", () => {
  test("keyboard: Tab to a row, arrow down, select, delete; focus stays in place", async ({
    page,
  }) => {
    for (const years of [200000, 100000, 0]) await collapse.sampleAt(years);
    // The last heading is the tab stop just before the first row.
    await collapse.sortButton("Rock above cave (mm)").focus();
    await page.keyboard.press("Tab");
    await expect(collapse.sampleRow(200000)).toBeFocused();
    await expect(collapse.sampleRow(200000)).toHaveClass(/\bkb-focus\b/);

    await page.keyboard.press("ArrowDown");
    await expect(collapse.sampleRow(100000)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(collapse.sampleRow(100000)).toHaveAttribute("aria-current", "true");
    // Selecting must not drop the keyboard ring.
    await expect(collapse.sampleRow(100000)).toHaveClass(/\bkb-focus\b/);
    await expect(collapse.crossSectionCaption).toHaveText("100,000 yr before collapse");

    await page.keyboard.press("ArrowRight");
    await expect(collapse.deleteButton(100000)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(collapse.tableRows).toHaveCount(2);
    // Same position: the row that moved up into it, on its delete button.
    await expect(collapse.deleteButton(0)).toBeFocused();
    await expect(collapse.crossSectionCaption).toHaveCount(0);
  });

  test("a click focuses a row without the keyboard ring", async () => {
    await collapse.sampleButton.click();
    await collapse.sampleRow(200000).click();
    await expect(collapse.sampleRow(200000)).toBeFocused();
    await expect(collapse.sampleRow(200000)).not.toHaveClass(/\bkb-focus\b/);
  });

  test("limestone + wet collapses at year 0", async ({ page }) => {
    await collapse.selectTrial("B");
    await collapse.timelineSlider.focus();
    await page.keyboard.press("End");
    await collapse.sampleButton.click();
    await expect(collapse.sampleRow(0)).toContainText("collapsed");
    await expect(collapse.sampleRow(0)).toContainText("(2,800)");
    await expect(collapse.sampleRow(0)).toHaveAttribute("aria-label", /, collapsed$/);
  });

  test("the average row sits on the table's bottom edge", async () => {
    await collapse.sampleButton.click();
    const scroller = await collapse.tableScroller.boundingBox();
    const foot = await collapse.averageRow.boundingBox();
    if (!scroller || !foot) throw new Error("table not found");
    expect(Math.abs(scroller.y + scroller.height - (foot.y + foot.height))).toBeLessThanOrEqual(1);
  });

  test("with many rows, the rows scroll and the header and average row stay put", async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.endsWith("-767"), "checked at the narrowest width");
    for (const years of [200000, 150000, 100000, 50000, 20000, 10000]) {
      await collapse.sampleAt(years);
    }
    const head = page.locator(".collapse-thead th").nth(1);
    const box = async () => ({
      head: await head.boundingBox(),
      foot: await collapse.averageRow.locator("th").boundingBox(),
      first: await collapse.tableRows.first().boundingBox(),
    });
    // The newest row was scrolled into view, so scroll back to the top first.
    await collapse.tableScroller.evaluate((el) => {
      el.scrollTop = 0;
    });
    const before = await box();
    const scrolls = await collapse.tableScroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      return el.scrollTop > 0;
    });
    expect(scrolls).toBe(true);
    const after = await box();
    expect(after.head).toEqual(before.head);
    expect(after.foot).toEqual(before.foot);
    expect(after.first?.y).toBeLessThan(before.first?.y ?? 0);
  });

  test("pointing at any part of a heading's label hits that heading's sort button", async ({
    page,
  }) => {
    await collapse.sampleButton.click();
    // The label's and icon's outer edges, where a neighboring column would take the press. Polled:
    // until the webfonts load, the headings have the fallback font's widths, and the spacing is
    // measured again once they land.
    const misses = () =>
      page.evaluate(() => {
        const out: string[] = [];
        for (const button of document.querySelectorAll<HTMLElement>(".collapse-th-sort")) {
          for (const part of [".collapse-th-lines", ".collapse-sort-ico"]) {
            const box = button.querySelector(part)?.getBoundingClientRect();
            if (!box) throw new Error(`${button.textContent} has no ${part}`);
            for (const x of [box.left + 1, box.right - 1]) {
              const hit = document.elementFromPoint(x, box.top + box.height / 2);
              if (hit?.closest(".collapse-th-sort") !== button)
                out.push(`${button.textContent} ${part}`);
            }
          }
        }
        return out;
      });
    await expect.poll(misses).toEqual([]);
  });
});
