import { expect, test } from "@playwright/test";
import { NoreasterPage } from "../../pages/noreaster-page";
import { MAX_TRIALS } from "../../testdata/noreaster-testdata";

// The Run animation defers the outcome until it finishes (up to ~11.5 s). These tests assert the
// post-run state (outcome, scene, locked selectors), so run them under reduced motion — the runner
// finalizes at once, reaching that state instantly. Normal-motion timing is covered separately below.
test.use({ contextOptions: { reducedMotion: "reduce" } });

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

// The five Weather-Outcome attribute rows (full names — the accessible name at every width).
const WEATHER_ATTRIBUTES = [
  "Sky",
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

  // The selected trial's card body now shows the two-line outcome banner (single-sourced label).
  await expect(sim.trialCardOutcome("A")).toContainText("Strong");
  await expect(sim.trialCardOutcome("A")).toContainText("nor’easter");

  await sim.resetTrialButton.click();
  // Reset restores the default state: every dropdown returns, Replay reverts to a disabled Run, and
  // the card body clears (its outcome banner is gone).
  for (const field of AIR_MASS_FIELDS) {
    await expect(sim.dropdown(field)).toBeVisible();
  }
  await expect(sim.replayButton).toHaveCount(0);
  await expect(sim.runButton).toHaveAttribute("aria-disabled", "true");
  await expect(sim.trialCardOutcome("A")).toHaveCount(0);
});

test("Data panel: renders the 'Weather Outcome' header and the five attribute rows", async () => {
  await expect(sim.weatherOutcomeHeading).toBeVisible();
  await expect(sim.attributeRows).toHaveCount(WEATHER_ATTRIBUTES.length);
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
  await expect(sim.outcomeValue("Sunny")).toBeVisible();
  await expect(sim.outcomeValue("Variable, 0–10 mph")).toBeVisible();
});

test("Data panel: shows the 'Windy, no storm' outcome", async () => {
  await sim.completeSetup("windy");
  await sim.runButton.click();
  await expect(sim.outcomePill).toHaveText("Windy, no storm");
  await expect(sim.outcomeValue("Clear, breezy")).toBeVisible();
  await expect(sim.outcomeValue("From the NW, 15–25 mph")).toBeVisible();
});

test("Data panel: shows the 'Humid, no storm' outcome", async () => {
  await sim.completeSetup("humidNoStorm");
  await sim.runButton.click();
  await expect(sim.outcomePill).toHaveText("Humid, no storm");
  await expect(sim.outcomeValue("From the S/SE, 5–15 mph")).toBeVisible();
  await expect(sim.outcomeValue("Scattered rain")).toBeVisible();
});

test("Data panel: the weather scene tracks the outcome and clears on Reset", async () => {
  // Default (unrun): no scene.
  await expect(sim.weatherScene).toHaveAttribute("data-scene", "default");

  await sim.completeSetup(); // strong nor'easter
  await sim.runButton.click();
  await expect(sim.weatherScene).toHaveAttribute("data-scene", "strong");

  await sim.resetTrialButton.click();
  // Reset removes the scene at once (no frozen frame) — back to default, and instant (no fade-OUT: Reset
  // doesn't bump the run token, so the panel never re-arms the transition).
  await expect(sim.weatherScene).toHaveAttribute("data-scene", "default");
  await expect(sim.weatherScene).toHaveAttribute("data-animate", "instant");
});

test("Data panel: the weather scene reflects the fair-weather outcome", async () => {
  await sim.completeSetup("fair");
  await sim.runButton.click();
  await expect(sim.weatherScene).toHaveAttribute("data-scene", "fair");
});

test("Data panel: the weather scene reflects the humid-no-storm outcome", async () => {
  await sim.completeSetup("humidNoStorm");
  await sim.runButton.click();
  await expect(sim.weatherScene).toHaveAttribute("data-scene", "humidNoStorm");
});

// The real deferred timing + the normal-motion fade both need no-preference motion. Use a fast outcome
// ("windy", ~3 s to finalize) so these stay quick.
test.describe("run animation — normal motion (deferred)", () => {
  test.use({ contextOptions: { reducedMotion: "no-preference" } });

  test("Run enters a running phase, defers the outcome, then commits it (arrows removed, pills kept)", async () => {
    await sim.completeSetup("windy"); // land N/NW (arrow 1), ocean S/SE (arrow 2); ~3 s to finalize

    await sim.runButton.click();
    // Running phase: the outcome is NOT committed yet (deferred). Assert the deferral with a single
    // snapshot (not an auto-retrying matcher) so it can't race the ~3 s commit window on a loaded worker —
    // once the running phase is up, the pill still reads "–".
    await expect(sim.mapStage).toHaveAttribute("data-run-phase", "running");
    expect(await sim.outcomePill.textContent()).toBe("–");

    await expect(sim.outcomePill).toHaveText("Windy, no storm", { timeout: 8000 });
    await expect(sim.replayButton).toBeVisible();
    await expect(sim.mapStage).not.toHaveAttribute("data-run-phase", "running");

    // The two selected pathway arrows are removed while their pills stay; the companions + pills vanish.
    await expect(sim.arrow(1)).toHaveAttribute("data-run-state", "removed");
    await expect(sim.arrow(2)).toHaveAttribute("data-run-state", "removed");
    await expect(sim.pill(1)).not.toHaveAttribute("data-run-state");
    await expect(sim.pill(2)).not.toHaveAttribute("data-run-state");
    await expect(sim.arrow(4)).toHaveAttribute("data-run-state", "hidden"); // companion land W
    await expect(sim.pill(4)).toHaveAttribute("data-run-state", "hidden");
  });

  test("Data panel pill: first run shows the 'Simulating…' face, then resolves to the outcome", async () => {
    // Verifies the real-CSS phase behavior the jsdom tests can't: the overlay is shown and the outcome
    // label hidden beneath it while running, then they swap on completion. `toHaveCSS` auto-retries, so
    // it settles past the 0.6s crossfade without a hand-tuned wait.
    await sim.completeSetup("windy"); // ~3 s to finalize
    await sim.runButton.click();
    await expect(sim.outcomePillBox).toHaveAttribute("data-phase", "simulating");
    await expect(sim.simulatingLabel).toHaveCSS("opacity", "1"); // "Simulating…" shown
    await expect(sim.outcomePill).toHaveCSS("opacity", "0"); // outcome label hidden beneath

    await expect(sim.outcomePill).toHaveText("Windy, no storm", { timeout: 8000 });
    await expect(sim.outcomePillBox).toHaveAttribute("data-phase", "filled");
    await expect(sim.simulatingLabel).toHaveCSS("opacity", "0"); // overlay faded out
  });

  test("Data panel pill: a replay keeps the outcome label (simulating-replay face)", async () => {
    await sim.completeSetup("windy");
    await sim.runButton.click();
    await expect(sim.replayButton).toBeVisible({ timeout: 8000 });

    await sim.replayButton.click();
    await expect(sim.outcomePillBox).toHaveAttribute("data-phase", "simulating-replay");
    await expect(sim.outcomePill).toHaveText("Windy, no storm"); // outcome label kept, not "Simulating…"
    await expect(sim.simulatingLabel).toHaveCSS("opacity", "0"); // no overlay on a replay
  });

  test("Data panel weather scene: a fresh run applies the 0.6s opacity fade", async () => {
    // Nothing else verifies the transition itself, so it could be removed or mistyped and every other
    // test would still pass. The fade is outcome-independent; a fast outcome keeps this quick.
    await sim.completeSetup("windy");
    await sim.runButton.click();
    await expect(sim.weatherScene).toHaveAttribute("data-animate", "fade", { timeout: 8000 });
    const applied = await sim.weatherScene.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        reduceMatches: matchMedia("(prefers-reduced-motion: reduce)").matches,
        property: s.transitionProperty,
        duration: s.transitionDuration,
      };
    });
    expect(applied).toEqual({ reduceMatches: false, property: "opacity", duration: "0.6s" });
  });
});

test("Data panel weather scene: reduced motion themes the scene but suppresses the fade", async () => {
  // Reduced motion comes from the file-level `test.use` (contextOptions) — no per-test emulateMedia needed.
  await sim.completeSetup(); // strong
  await sim.runButton.click();
  // The backdrop still themes under reduced motion…
  await expect(sim.weatherScene).toHaveAttribute("data-scene", "strong");
  // …and this is a fresh finalization, so the panel still asks for the fade…
  await expect(sim.weatherScene).toHaveAttribute("data-animate", "fade");
  // …but CSS suppresses it: with reduced motion emulated, the computed transition is `none`.
  const applied = await sim.weatherScene.evaluate((el) => ({
    reduceMatches: matchMedia("(prefers-reduced-motion: reduce)").matches,
    transitionProperty: getComputedStyle(el).transitionProperty,
  }));
  expect(applied).toEqual({ reduceMatches: true, transitionProperty: "none" });
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
