import { expect, test } from "@playwright/test";
import { CollapsePage } from "../../pages/collapse-page";

// Collapse functional spec: runs once per target width. Covers the timeline's pointer behavior with
// the real layout and real pointer input, which the jsdom tests can only approximate with fixed label
// widths.

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
