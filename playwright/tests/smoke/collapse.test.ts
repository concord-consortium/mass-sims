import { expect, test } from "@playwright/test";
import { CollapsePage } from "../../pages/collapse-page";
import { TRIAL_LETTERS } from "../../testdata/collapse-testdata";

// Runs once per target width (1044 / 1024 / 989 / 767).

let collapse: CollapsePage;

test.beforeEach(async ({ page }) => {
  collapse = new CollapsePage(page);
  await collapse.goto();
});

test("loads the sim shell", async () => {
  await expect(collapse.simTitle).toHaveText("Collapse!");
  await expect(collapse.tagline).toBeVisible();
  await expect(collapse.aboutButton).toBeVisible();
  await expect(collapse.trialsSlot).toBeVisible();
  await expect(collapse.simulationSlot).toBeVisible();
  await expect(collapse.dataSlot).toHaveCount(0);
  await expect(collapse.trialsListbox).toBeVisible();
  await expect(collapse.crossSectionRegion).toBeVisible();
  expect(Math.abs(await collapse.simulationSlotRightGap())).toBeLessThanOrEqual(1);
});

test("About modal: opens via button, closes via close button, closes via Escape", async () => {
  await collapse.openAbout();
  await collapse.closeAboutViaButton();
  await collapse.openAbout();
  await collapse.closeAboutViaEscape();
});

test("About modal: not open on initial load", async () => {
  await expect(collapse.aboutPanel).toBeHidden();
});

test("Reload warning does NOT fire on clean state", async () => {
  await collapse.assertReloadWarning(false);
});

test("Trial selector: exactly A–D are seeded, A selected, in a vertical listbox", async () => {
  expect(TRIAL_LETTERS).toEqual(["A", "B", "C", "D"]);
  await expect(collapse.trialsListbox).toHaveAttribute("aria-orientation", "vertical");
  await expect(collapse.trialOptions).toHaveCount(TRIAL_LETTERS.length);
  for (const letter of TRIAL_LETTERS) await expect(collapse.trialOption(letter)).toBeVisible();
  await expect(collapse.trialOption("A")).toHaveAttribute("aria-selected", "true");
  await expect(collapse.trialOption("D")).toHaveAttribute("aria-selected", "false");
});

test("Trial reset: a click on the selected card's reset reaches the button", async () => {
  // Checks that the reset is on top of the lifted selected card. The reset is aria-disabled until the
  // trial has output, which nothing can produce yet, so `force` skips Playwright's enabled check.
  // The mouse still lands at the button's position, so a card painted over it would take the focus.
  await expect(collapse.trialOption("A")).toHaveAttribute("aria-selected", "true");
  await collapse.trialResetButton("A").click({ force: true });
  await expect(collapse.trialResetButton("A")).toBeFocused();
});

test("Keyboard nav: ArrowDown moves focus AND selection to the next trial", async ({ page }) => {
  await collapse.trialOption("A").focus();
  await page.keyboard.press("ArrowDown");
  await expect(collapse.trialOption("B")).toHaveAttribute("aria-selected", "true");
  // Roving tabindex moves focus too, not just selection.
  expect(await collapse.focusedAriaLabel()).toMatch(/^Trial B\b/);
});
