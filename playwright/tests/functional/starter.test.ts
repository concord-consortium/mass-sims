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

test.describe("Trials column — + New card in the roving ring + tab order", () => {
  // Real-Tab and arrow-key traversal across the cards, the + New card, and the reset button —
  // behavior driven by the shared useTrialsKeyboardNav hook, so this coverage stands in for every
  // sim. Three trials (A, B, C): the list doesn't overflow, so no scroll-region tab stop interferes.
  test.beforeEach(async () => {
    await starter.addTrial(); // B
    await starter.addTrial(); // C (now selected + focused)
  });

  test("ArrowDown from the last card, and End from any card, land on the + New card", async () => {
    await starter.selectTrial("C"); // last card, selected + focused
    await starter.press("ArrowDown");
    expect(await starter.focusedAriaLabel()).toBe("Add new trial");

    await starter.selectTrial("A");
    await starter.press("End");
    expect(await starter.focusedAriaLabel()).toBe("Add new trial");
  });

  test("ArrowUp from the first card lands on + New; Home from + New returns to the first card", async () => {
    await starter.selectTrial("A"); // first card
    await starter.press("ArrowUp");
    expect(await starter.focusedAriaLabel()).toBe("Add new trial");

    await starter.press("Home");
    expect(await starter.focusedAriaLabel()).toBe("Trial A. Walker count 50, step size 1");
  });

  test("Tab from a trial card goes to its reset, then out to the Simulation region", async () => {
    await starter.selectTrial("A"); // focuses card A
    await starter.press("Tab");
    expect(await starter.focusedAriaLabel()).toBe("Reset trial A"); // card → its reset
    await starter.press("Tab");
    expect(await starter.isFocusWithin(starter.simulationSlot)).toBe(true); // reset → Simulation
  });

  test("Tab from the + New card skips the reset and goes straight to the Simulation region", async () => {
    await starter.selectTrial("A");
    await starter.press("End"); // roving focus → + New card
    await expect(starter.newTrialCard).toBeFocused();
    await starter.press("Tab");
    expect(await starter.focusedAriaLabel()).not.toBe("Reset trial A"); // reset is skipped
    expect(await starter.isFocusWithin(starter.simulationSlot)).toBe(true);
  });

  test("the cards + the + New card form a SINGLE tab stop (Shift+Tab into the column returns to it)", async () => {
    await starter.selectTrial("A");
    await starter.press("End"); // park roving focus on + New
    await expect(starter.newTrialCard).toBeFocused();
    await starter.press("Tab"); // leave the column (→ Simulation)
    expect(await starter.isFocusWithin(starter.simulationSlot)).toBe(true);
    await starter.press("Shift+Tab"); // back into the column → the remembered + New card
    await expect(starter.newTrialCard).toBeFocused();
  });
});
