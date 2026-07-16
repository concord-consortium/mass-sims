import { expect, test } from "@playwright/test";
import { NoreasterPage } from "../../pages/noreaster-page";
import { MAX_TRIALS } from "../../testdata/noreaster-testdata";

// Nor'easter smoke suite. Conventions:
//   - a per-sim page object (NoreasterPage) owns all locators + navigation; the spec body has no
//     raw locators,
//   - each test starts from a fresh page via `await sim.goto()` (no shared state, no baseURL — the
//     page object reads its URL from the sims registry),
//   - assertions favor visible/role-based checks.
// It runs once per viewport project (1044 / 1024 / 989 / 767) from the four-width matrix.

let sim: NoreasterPage;

test.beforeEach(async ({ page }) => {
  sim = new NoreasterPage(page);
  await sim.goto();
});

test("loads the sim shell", async () => {
  await expect(sim.simTitle).toHaveText("Nor’easter");
  await expect(sim.tagline).toBeVisible();
  await expect(sim.aboutButton).toBeVisible();
  await expect(sim.trialsSlot).toBeVisible();
  await expect(sim.simulationSlot).toBeVisible();
  await expect(sim.dataSlot).toBeVisible();
  await expect(sim.trialsListbox).toBeVisible();
});

test("About modal: opens via button, closes via close button, closes via Escape", async () => {
  await sim.openAbout();
  await sim.closeAboutViaButton();
  await sim.openAbout();
  await sim.closeAboutViaEscape();
});

test("About modal: not open on initial load", async () => {
  await expect(sim.aboutPanel).toBeHidden();
});

test("Reload warning does NOT fire on clean state", async () => {
  // Fresh load, no trial run → output is null → no beforeunload prompt.
  await sim.assertReloadWarning(false);
});

test("Trial selector: A is seeded as the selected option in a vertical listbox", async () => {
  await expect(sim.trialsListbox).toHaveAttribute("aria-orientation", "vertical");
  await expect(sim.trialOption("A")).toHaveAttribute("aria-selected", "true");
  await expect(sim.trialOption("B")).toHaveCount(0);
  await expect(sim.newTrialCard).toBeVisible();
});

test("Keyboard nav: ArrowDown moves focus AND selection to the next trial", async ({ page }) => {
  // Add a second trial (auto-selected), then go back to A so ArrowDown has somewhere to move.
  await sim.addTrial();
  await sim.selectTrial("A");
  await sim.trialOption("A").focus();
  await page.keyboard.press("ArrowDown");
  await expect(sim.trialOption("B")).toHaveAttribute("aria-selected", "true");
  // Roving tabindex moves focus too, not just selection.
  expect(await sim.focusedAriaLabel()).toMatch(/^Trial B\b/);
});

test("Cap values match expected literals", () => {
  // Single-source-of-truth safety net: MAX_TRIALS is imported from shared, but an import alone can't
  // flag a silent change to the value. An intentional cap change updates both; an accidental one
  // trips here.
  expect(MAX_TRIALS).toBe(10);
});
