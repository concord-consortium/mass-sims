import { expect, test } from "@playwright/test";
import { BananasPage } from "../../pages/bananas-page";
import { MAX_CROSSES, MAX_TRIALS } from "../../testdata/bananas-testdata";

// Bananas smoke spec — mirrors the Starter smoke shape (shared chrome + About modal) and adds
// Bananas-specific load assertions confirming correct rendering. Runs once per viewport
// project (1044 / 1024 / 989 / 767). Rich behavior lives in the functional spec.

let bananas: BananasPage;

test.beforeEach(async ({ page }) => {
  bananas = new BananasPage(page);
  await bananas.goto();
});

test("loads the sim shell", async () => {
  await expect(bananas.simTitle).toHaveText("Bananas");
  await expect(bananas.tagline).toBeVisible();
  await expect(bananas.aboutButton).toBeVisible();
  await expect(bananas.trialsSlot).toBeVisible();
  await expect(bananas.simulationSlot).toBeVisible();
  await expect(bananas.dataSlot).toBeVisible();
});

test("About modal: opens via button, closes via close button, closes via Escape", async () => {
  await bananas.openAbout();
  await bananas.closeAboutViaButton();
  await bananas.openAbout();
  await bananas.closeAboutViaEscape();
});

test("About modal: not open on initial load", async () => {
  await expect(bananas.aboutPanel).toBeHidden();
});

test("Trial A is seeded and selected on load", async () => {
  // Exactly one trial card (A) exists, and it's the active selection.
  await expect(bananas.trialOption("A")).toBeVisible();
  await expect(bananas.trialOption("B")).toHaveCount(0);
  expect(await bananas.getActiveTrialLetter()).toBe("A");
});

test("Both parent selects are visible and enabled", async () => {
  await expect(bananas.parent1Select).toBeEnabled();
  await expect(bananas.parent2Select).toBeEnabled();
});

test("Cross Plants and Reset Trial are visible but disabled in the initial state", async () => {
  // Both controls render; with no parents and no crosses, both are disabled. The shared Button
  // marks disabled via aria-disabled (keeping the control keyboard-focusable), not a native
  // disabled attribute.
  await expect(bananas.crossPlantsButton).toBeVisible();
  await expect(bananas.crossPlantsButton).toHaveAttribute("aria-disabled", "true");
  await expect(bananas.resetTrialButton).toBeVisible();
  await expect(bananas.resetTrialButton).toHaveAttribute("aria-disabled", "true");
});

test("Status pill is hidden until both parents are picked", async () => {
  await expect(bananas.statusPill).toBeHidden();
});

test("Cap values match expected literals", () => {
  // Safety net for the re-export-from-source testdata pattern: the caps are imported from the sim,
  // but an import alone can't flag a silent change to a behavior-defining number. An intentional
  // cap change updates both the sim constant and these literals; an accidental one trips here. (No
  // page needed — a pure check of the imported constants.)
  expect(MAX_CROSSES).toBe(6);
  expect(MAX_TRIALS).toBe(10);
});
