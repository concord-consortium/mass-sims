import { expect, test } from "@playwright/test";
import { StarterPage } from "../../pages/starter-page";
import { MAX_TRIALS } from "../../testdata/starter-testdata";

// Starter functional coverage that needs a real browser (overflow-driven behavior jsdom can't
// observe). Uses StarterPage methods only, fresh page per test, once per viewport project.

let starter: StarterPage;

test.beforeEach(async ({ page }) => {
  starter = new StarterPage(page);
  await starter.goto();
});

test.describe("Scroll-region tabindex on overflow", () => {
  // Guards the shared `Section scrollFocusRing` opt-in for Starter: the Trials-list scroll
  // container is a dead tab stop only while the list overflows. Filling to MAX_TRIALS overflows the
  // fixed-height list (constant height 562), so tabindex="0" appears.
  test("trials list becomes focusable only when it overflows", async () => {
    await expect(starter.trialsScrollRegion).not.toHaveAttribute("tabindex");

    for (let i = 0; i < MAX_TRIALS - 1; i++) await starter.addTrial();
    await expect(starter.maxTrialsNotice).toBeVisible();

    await expect(starter.trialsScrollRegion).toHaveAttribute("tabindex", "0");
  });
});
