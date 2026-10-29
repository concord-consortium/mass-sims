import { expect, test } from "@playwright/test";
import { CollapsePage } from "../../pages/collapse-page";
import { roofAt, TRIAL_CONDITIONS, TRIAL_LETTERS } from "../../testdata/collapse-testdata";

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
  // The Trials column never scrolls, so it is not a tab stop.
  await expect(collapse.trialsScrollRegion).not.toHaveAttribute("tabindex");
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
  // Checks that the reset is on top of the lifted selected card: a card painted over it would take
  // the click and the focus.
  await expect(collapse.trialOption("A")).toHaveAttribute("aria-selected", "true");
  await collapse.sampleButton.click();
  await collapse.trialResetButton("A").click();
  await expect(collapse.trialResetButton("A")).toBeFocused();
});

test("Keyboard nav: ArrowDown moves focus AND selection to the next trial", async ({ page }) => {
  await collapse.trialOption("A").focus();
  await page.keyboard.press("ArrowDown");
  await expect(collapse.trialOption("B")).toHaveAttribute("aria-selected", "true");
  // Roving tabindex moves focus too, not just selection.
  expect(await collapse.focusedAriaLabel()).toMatch(/^Trial B\b/);
});

test("Timeline: starts at 200,000; the slider and stepper change one shared value", async ({
  page,
}) => {
  await expect(collapse.timelineSlider).toHaveAttribute("aria-valuenow", "200000");
  await expect(collapse.yearDisplay).toHaveText("200,000");
  await expect(collapse.earlierButton).toHaveAttribute("aria-disabled", "true");

  await collapse.timelineSlider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(collapse.timelineSlider).toHaveAttribute("aria-valuenow", "150000");
  await expect(collapse.yearDisplay).toHaveText("150,000");

  await collapse.laterButton.click();
  await expect(collapse.timelineSlider).toHaveAttribute("aria-valuenow", "100000");
  await expect(collapse.yearDisplay).toHaveText("100,000");

  await collapse.timelineSlider.focus();
  await page.keyboard.press("End");
  await expect(collapse.timelineSlider).toHaveAttribute("aria-valuenow", "0");
  await expect(collapse.laterButton).toHaveAttribute("aria-disabled", "true");
});

test("Data table: Sample adds a selected row with the model's numbers", async () => {
  await expect(collapse.promptPill).toBeVisible();
  await expect(collapse.averageRow).toHaveCount(0);

  await collapse.sampleButton.click();
  await expect(collapse.tableRows).toHaveCount(1);
  const roof = roofAt(TRIAL_CONDITIONS.A, 200000).toLocaleString("en-US");
  await expect(collapse.sampleRow(200000)).toHaveAttribute(
    "aria-label",
    new RegExp(`rock above cave ${roof} mm$`),
  );
  await expect(collapse.sampleRow(200000)).toHaveAttribute("aria-current", "true");
  await expect(collapse.promptPill).toHaveCount(0);
  await expect(collapse.averageRow).toBeVisible();
  await expect(collapse.crossSectionCaption).toHaveText("200,000 yr before collapse");
  await expect(collapse.trialOption("A")).toHaveAttribute("aria-label", /Sampled 1 time$/);
  await collapse.assertReloadWarning(true);
});

test("Data table: sorts, deletes, and resets", async () => {
  await collapse.sampleAt(200000);
  await collapse.sampleAt(0);
  await expect(collapse.tableRows).toHaveCount(2);

  await collapse.sortButton("Erosion rate (mm/1,000 yr)").click();
  await expect(collapse.sortHeader("Erosion rate (mm/1,000 yr)")).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await collapse.sortButton("Years before collapse (yr)").click();
  await expect(collapse.sortHeader("Years before collapse (yr)")).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await expect(collapse.tableRows.first()).toHaveAttribute("aria-label", /^Sample at 0 years/);

  await collapse.deleteButton(0).click();
  await expect(collapse.tableRows).toHaveCount(1);
  await collapse.deleteButton(200000).click();
  await expect(collapse.tableRows).toHaveCount(0);
  await expect(collapse.promptPill).toBeVisible();
  await expect(collapse.averageRow).toHaveCount(0);

  await collapse.sampleButton.click();
  await expect(collapse.trialResetButton("A")).not.toHaveAttribute("aria-disabled");
  await collapse.trialResetButton("A").click();
  await expect(collapse.tableRows).toHaveCount(0);
  await expect(collapse.trialResetButton("A")).toHaveAttribute("aria-disabled", "true");
});

test("Data table: each trial has its own table", async () => {
  await collapse.sampleButton.click();
  await collapse.selectTrial("B");
  await expect(collapse.tableRows).toHaveCount(0);
  await expect(collapse.promptPill).toBeVisible();
  await collapse.selectTrial("A");
  await expect(collapse.tableRows).toHaveCount(1);
});
