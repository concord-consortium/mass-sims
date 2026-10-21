import { expect, test } from "@playwright/test";
import { CollapsePage } from "../../pages/collapse-page";
import { MAX_TRIALS } from "../../testdata/collapse-testdata";

// CANONICAL SMOKE TEMPLATE. `yarn new-sim` copies this file as the starting point for every new
// sim's smoke spec, so we keep it small, didactic, and representative of the conventions:
//   - a per-sim page object (CollapsePage) owns all locators + navigation; the spec body has no
//     raw locators,
//   - each test starts from a fresh page via `await collapse.goto()` (no shared state, no
//     baseURL — the page object reads its URL from the sims registry),
//   - assertions favor visible/role-based checks.
// It runs once per viewport project (1044 / 1024 / 989 / 767) from the four-width matrix.

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
  await expect(collapse.dataSlot).toBeVisible();
  await expect(collapse.trialsListbox).toBeVisible();
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

test("Simulation controls render with a sensible default disabled state", async () => {
  await expect(collapse.playButton).toBeEnabled();
  await expect(collapse.stepButton).toBeEnabled();
  await expect(collapse.resetButton).toBeDisabled();
});

test("Play / pause cycle", async () => {
  await expect(collapse.playButton).toBeVisible();
  // Play: the button toggles to "Pause" and the run advances (Reset enables once frame > 0) —
  // that enablement is the visible proof the simulation is actually running.
  await collapse.playButton.click();
  await expect(collapse.pauseButton).toBeVisible();
  await expect(collapse.resetButton).toBeEnabled();
  // Pause: the button toggles back to "Play", confirming the runner stopped.
  await collapse.pauseButton.click();
  await expect(collapse.playButton).toBeVisible();
});

test("Reload warning fires after a trial completes", async () => {
  await collapse.completeOneTrial();
  await collapse.assertReloadWarning(true);
});

test("Reload warning does NOT fire on clean state", async () => {
  // Fresh load, no trial run → output is null → no beforeunload prompt.
  await collapse.assertReloadWarning(false);
});

test("Trial selector: A is seeded as the selected option in a vertical listbox", async () => {
  await expect(collapse.trialsListbox).toHaveAttribute("aria-orientation", "vertical");
  await expect(collapse.trialOption("A")).toHaveAttribute("aria-selected", "true");
  await expect(collapse.trialOption("B")).toHaveCount(0);
  await expect(collapse.newTrialCard).toBeVisible();
});

test("Keyboard nav: ArrowDown moves focus AND selection to the next trial", async ({ page }) => {
  // Add a second trial (auto-selected), then go back to A so ArrowDown has somewhere to move.
  await collapse.addTrial();
  await collapse.selectTrial("A");
  await collapse.trialOption("A").focus();
  await page.keyboard.press("ArrowDown");
  await expect(collapse.trialOption("B")).toHaveAttribute("aria-selected", "true");
  // Roving tabindex moves focus too, not just selection.
  expect(await collapse.focusedAriaLabel()).toMatch(/^Trial B\b/);
});

test("Cap values match expected literals", () => {
  // Single-source-of-truth safety net: MAX_TRIALS is imported from shared, but an import alone can't
  // flag a silent change to the value. An intentional cap change updates both; an accidental one
  // trips here.
  expect(MAX_TRIALS).toBe(10);
});
