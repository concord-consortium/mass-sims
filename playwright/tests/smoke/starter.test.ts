import { expect, test } from "@playwright/test";
import { StarterPage } from "../../pages/starter-page";

// CANONICAL SMOKE TEMPLATE. `yarn new-sim` copies this file as the starting point for every new
// sim's smoke spec, so we keep it small, didactic, and representative of the conventions:
//   - a per-sim page object (StarterPage) owns all locators + navigation; the spec body has no
//     raw locators,
//   - each test starts from a fresh page via `await starter.goto()` (no shared state, no
//     baseURL — the page object reads its URL from the sims registry),
//   - assertions favor visible/role-based checks.
// It runs once per viewport project (1044 / 1024 / 989 / 767) from the four-width matrix.

let starter: StarterPage;

test.beforeEach(async ({ page }) => {
  starter = new StarterPage(page);
  await starter.goto();
});

test("loads the sim shell", async () => {
  await expect(starter.simTitle).toHaveText("Random Walk");
  await expect(starter.tagline).toBeVisible();
  await expect(starter.aboutButton).toBeVisible();
  await expect(starter.trialsSlot).toBeVisible();
  await expect(starter.simulationSlot).toBeVisible();
  await expect(starter.dataSlot).toBeVisible();
});

test("About modal: opens via button, closes via close button, closes via Escape", async () => {
  await starter.openAbout();
  await starter.closeAboutViaButton();
  await starter.openAbout();
  await starter.closeAboutViaEscape();
});

test("About modal: not open on initial load", async () => {
  await expect(starter.aboutDialog).toBeHidden();
});

test("Simulation controls render with a sensible default disabled state", async () => {
  await expect(starter.playButton).toBeEnabled();
  await expect(starter.stepButton).toBeEnabled();
  await expect(starter.resetButton).toBeDisabled();
});

test("Play / pause cycle", async () => {
  await expect(starter.playButton).toBeVisible();
  // Play: the button toggles to "Pause" and the run advances (Reset enables once frame > 0) —
  // that enablement is the visible proof the simulation is actually running.
  await starter.playButton.click();
  await expect(starter.pauseButton).toBeVisible();
  await expect(starter.resetButton).toBeEnabled();
  // Pause: the button toggles back to "Play", confirming the runner stopped.
  await starter.pauseButton.click();
  await expect(starter.playButton).toBeVisible();
});

test("Reload warning fires after a trial completes", async () => {
  await starter.completeOneTrial();
  await starter.assertReloadWarning(true);
});

test("Reload warning does NOT fire on clean state", async () => {
  // Fresh load, no trial run → output is null → no beforeunload prompt.
  await starter.assertReloadWarning(false);
});
