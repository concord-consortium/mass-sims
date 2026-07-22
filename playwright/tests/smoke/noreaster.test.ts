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

// The five air-mass selector field labels (Land: Pathway/Humidity/Temperature; Ocean: Pathway/Humidity).
const AIR_MASS_FIELDS = [
  "Pathway for Land Air Mass",
  "Humidity for Land Air Mass",
  "Temperature for Land Air Mass",
  "Pathway for Ocean Air Mass",
  "Humidity for Ocean Air Mass",
];

// The six Weather-Outcome attribute rows (full names — the accessible name at every width).
const WEATHER_ATTRIBUTES = [
  "Sky",
  "Pressure",
  "Wind",
  "Precipitation Type",
  "Precipitation Amount",
  "Storm Intensity",
];

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

test("Simulation panel: renders the air-mass selectors, map, and control bar", async () => {
  for (const field of AIR_MASS_FIELDS) {
    await expect(sim.dropdown(field)).toBeVisible();
  }
  await expect(sim.mapImage).toBeVisible();
  await expect(sim.mapViewToggle).toBeVisible();
  await expect(sim.runButton).toBeVisible();
  await expect(sim.resetTrialButton).toBeVisible();
});

test("Simulation panel: controls are in their default states (Street; Run/Reset disabled)", async () => {
  await expect(sim.mapViewToggle).not.toBeChecked();
  await expect(sim.runButton).toHaveAttribute("aria-disabled", "true");
  await expect(sim.resetTrialButton).toHaveAttribute("aria-disabled", "true");
});

test("Run flow: complete setup → Run locks the selectors + becomes Replay → Reset restores defaults", async () => {
  // Run is disabled and there's no prompt until the setup is complete.
  await expect(sim.runButton).toHaveAttribute("aria-disabled", "true");
  await expect(sim.runPrompt).toHaveCount(0);

  await sim.completeSetup();
  // Setup complete → Run enables and the on-map "Click Run…" prompt appears.
  await expect(sim.runButton).not.toHaveAttribute("aria-disabled", "true");
  await expect(sim.runPrompt).toBeVisible();

  await sim.runButton.click();
  // On Run: every selector locks to a read-only pill (the dropdown buttons are gone), Run becomes
  // Replay, the prompt hides, and Reset is enabled.
  await expect(sim.replayButton).toBeVisible();
  await expect(sim.runButton).toHaveCount(0);
  for (const field of AIR_MASS_FIELDS) {
    await expect(sim.dropdown(field)).toHaveCount(0);
  }
  await expect(sim.runPrompt).toHaveCount(0);
  await expect(sim.resetTrialButton).not.toHaveAttribute("aria-disabled", "true");

  await sim.resetTrialButton.click();
  // Reset restores the default state: every dropdown returns, Replay reverts to a disabled Run.
  for (const field of AIR_MASS_FIELDS) {
    await expect(sim.dropdown(field)).toBeVisible();
  }
  await expect(sim.replayButton).toHaveCount(0);
  await expect(sim.runButton).toHaveAttribute("aria-disabled", "true");
});

test("Data panel: renders the 'Weather Outcome' header and the six attribute rows", async () => {
  await expect(sim.weatherOutcomeHeading).toBeVisible();
  for (const attribute of WEATHER_ATTRIBUTES) {
    await expect(sim.attributeRow(attribute)).toBeVisible();
  }
});

test("Data panel: fills on Run and clears on Reset Trial", async () => {
  // Default (unrun) state: the pill shows the en-dash placeholder.
  await expect(sim.outcomePill).toHaveText("–");

  await sim.completeSetup(); // strong nor'easter
  await sim.runButton.click();

  // Filled: the pill shows the banner and a distinctive strong value renders.
  await expect(sim.outcomePill).toHaveText("Strong nor’easter");
  await expect(sim.outcomeValue("From the NE, 45–60 mph")).toBeVisible();

  await sim.resetTrialButton.click();
  // Reset clears the panel back to the placeholder.
  await expect(sim.outcomePill).toHaveText("–");
});

test("Data panel: shows a different outcome (Fair weather)", async () => {
  await sim.completeSetup("fair");
  await sim.runButton.click();
  await expect(sim.outcomePill).toHaveText("Fair weather");
  await expect(sim.outcomeValue("Sunny and fair")).toBeVisible();
});

test("Map view toggle: switches the Street ⇄ Satellite basemap", async () => {
  await expect(sim.mapViewToggle).not.toBeChecked();
  await expect(sim.mapStage).toHaveAttribute("data-map-view", "street");

  await sim.toggleMapView();
  await expect(sim.mapViewToggle).toBeChecked();
  await expect(sim.mapStage).toHaveAttribute("data-map-view", "satellite");

  await sim.toggleMapView();
  await expect(sim.mapViewToggle).not.toBeChecked();
  await expect(sim.mapStage).toHaveAttribute("data-map-view", "street");
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
  // Fresh load, no selection made → the trial has no progress (canReset false) → no beforeunload prompt.
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
