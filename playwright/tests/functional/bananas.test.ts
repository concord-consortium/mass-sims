import { expect, test } from "@playwright/test";
import { BananasPage } from "../../pages/bananas-page";
import {
  BASELINE_CROSS,
  MAX_CROSSES,
  MAX_TRIALS,
  OFFSPRING_MAX,
  OFFSPRING_MIN,
} from "../../testdata/bananas-testdata";

// Bananas functional spec. The spec body uses BananasPage methods exclusively (no raw locators);
// every test starts from a fresh page via `bananas.goto()` (no shared state, no baseURL — the page
// object reads its URL from the sims registry). Runs once per viewport project (1044/1024/989/767).

let bananas: BananasPage;

test.beforeEach(async ({ page }) => {
  bananas = new BananasPage(page);
  await bananas.goto();
});

test.describe("Single-trial flow", () => {
  // Scenario 1: parents → fungus → cross → cross → reset.
  test("happy path: pick parents, add fungus, cross twice, then reset", async () => {
    await bananas.pickParents(BASELINE_CROSS.p1, BASELINE_CROSS.p2);

    // Fungus must be toggled BEFORE the first cross — it locks once a cross exists.
    await bananas.toggleFungus();
    await expect(bananas.fungusSwitch).toBeChecked();

    // First cross: one row of 5–20 offspring.
    await bananas.crossPlants();
    await expect(bananas.offspringRows).toHaveCount(1);
    const plantsInFirstCross = await bananas.offspringPlants(0).count();
    expect(plantsInFirstCross).toBeGreaterThanOrEqual(OFFSPRING_MIN);
    expect(plantsInFirstCross).toBeLessThanOrEqual(OFFSPRING_MAX);

    // Second cross: two rows.
    await bananas.crossPlants();
    await expect(bananas.offspringRows).toHaveCount(2);

    // Reset Trial (control bar) returns the trial to empty: no crosses, parents unlocked again,
    // and Cross Plants disabled (clean state).
    await bananas.resetActiveTrial();
    await expect(bananas.offspringRows).toHaveCount(0);
    await expect(bananas.parent1Select).toBeEnabled();
    await expect(bananas.crossPlantsButton).toHaveAttribute("aria-disabled", "true");
  });
});

test.describe("Multi-trial", () => {
  // Scenario 2: create a second trial and switch between cards.
  test("create + switch updates the active-trial badge", async () => {
    expect(await bananas.getActiveTrialLetter()).toBe("A");

    await bananas.addTrial();
    await expect(bananas.trialTab("B")).toBeVisible();
    expect(await bananas.getActiveTrialLetter()).toBe("B"); // new trial auto-selected

    await bananas.selectTrial("A");
    expect(await bananas.getActiveTrialLetter()).toBe("A");

    await bananas.selectTrial("B");
    expect(await bananas.getActiveTrialLetter()).toBe("B");
  });

  // Scenario 3: per-trial selectedCross memory survives switching away and back.
  test("a trial remembers its selected cross after switching away and back", async () => {
    await bananas.pickParents(BASELINE_CROSS.p1, BASELINE_CROSS.p2);
    await bananas.crossPlants();
    await bananas.crossPlants();
    await expect(bananas.offspringRows).toHaveCount(2);

    // Select trial A's second cross (0-based index 1).
    await bananas.selectCross(1);
    await expect(bananas.crossRowButton(1)).toHaveAttribute("aria-pressed", "true");

    // Create + switch to B, then back to A — the selection must persist.
    await bananas.addTrial();
    expect(await bananas.getActiveTrialLetter()).toBe("B");
    await bananas.selectTrial("A");
    expect(await bananas.getActiveTrialLetter()).toBe("A");
    await expect(bananas.crossRowButton(1)).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("Per-card reset", () => {
  // Scenario 4: the per-card reset overhang resets that card and keeps it active. This is a
  // different code path from the control-bar "Reset Trial" button (it targets the acted-on card).
  test("the card reset overhang clears the trial and keeps it active", async () => {
    await bananas.pickParents(BASELINE_CROSS.p1, BASELINE_CROSS.p2);
    await bananas.crossPlants();
    await expect(bananas.offspringRows).toHaveCount(1);

    await bananas.resetTrialViaCardOverhang("A");
    await expect(bananas.offspringRows).toHaveCount(0);
    expect(await bananas.getActiveTrialLetter()).toBe("A"); // remains active
    await expect(bananas.parent1Select).toBeEnabled(); // unlocked back to the selectors
  });
});

test.describe("About modal", () => {
  // Scenario 5: three close paths + the initial-load guard.
  test("opens via button, closes via close button and via Escape; not open on load", async () => {
    await expect(bananas.aboutDialog).toBeHidden(); // initial load did not auto-open it
    await bananas.openAbout();
    await bananas.closeAboutViaButton();
    await bananas.openAbout();
    await bananas.closeAboutViaEscape();
  });
});

test.describe("Reload warning", () => {
  // Scenario 6: the standalone reload warning is gated on any trial having progress. Detection
  // (a synthetic cancelable beforeunload + defaultPrevented, which is trace-independent) lives in
  // SimulationFramePage.assertReloadWarning — see that helper's comment for why not page.close().
  test("does NOT fire on a clean trial", async () => {
    await bananas.assertReloadWarning(false);
  });

  test("fires once a parent is picked", async () => {
    await bananas.pickParent1(BASELINE_CROSS.p1);
    await bananas.assertReloadWarning(true);
  });
});

test.describe("Active-trial badge sync", () => {
  // Scenario 7: the Simulation-panel badge tracks the selection through BOTH card-click and
  // keyboard navigation.
  test("badge follows selection via card click and via keyboard", async () => {
    await bananas.addTrial(); // adds B and selects it
    expect(await bananas.getActiveTrialLetter()).toBe("B");

    // Card click.
    await bananas.selectTrial("A");
    expect(await bananas.getActiveTrialLetter()).toBe("A");

    // Keyboard: A is focused after the click; ArrowDown moves selection (and the badge) to B.
    await bananas.press("ArrowDown");
    expect(await bananas.getActiveTrialLetter()).toBe("B");
  });
});

test.describe("Keyboard navigation in the Trials panel", () => {
  // Scenario 8: roving tabindex — Arrow moves focus AND selection (WAI-ARIA tabs pattern);
  // Home/End jump to first/last; ArrowDown at the last card does not wrap.
  test("arrow / Home / End move focus and selection, with no wrap at the ends", async () => {
    await bananas.addTrial(); // B
    await bananas.addTrial(); // C — three trials now (A, B, C)

    // Start focused on A.
    await bananas.selectTrial("A");
    expect(await bananas.getActiveTrialLetter()).toBe("A");
    expect(await bananas.focusedAriaLabel()).toMatch(/^Trial A\b/);

    // ArrowDown → B: focus, selection, AND aria-selected all move together (three signals, R4).
    await bananas.press("ArrowDown");
    expect(await bananas.getActiveTrialLetter()).toBe("B");
    expect(await bananas.focusedAriaLabel()).toMatch(/^Trial B\b/);
    await expect(bananas.trialTab("B")).toHaveAttribute("aria-selected", "true");

    // Home → A.
    await bananas.press("Home");
    expect(await bananas.getActiveTrialLetter()).toBe("A");
    expect(await bananas.focusedAriaLabel()).toMatch(/^Trial A\b/);

    // End → last (C).
    await bananas.press("End");
    expect(await bananas.getActiveTrialLetter()).toBe("C");
    expect(await bananas.focusedAriaLabel()).toMatch(/^Trial C\b/);

    // ArrowDown at the last card → stays on C (no wrap).
    await bananas.press("ArrowDown");
    expect(await bananas.getActiveTrialLetter()).toBe("C");
    expect(await bananas.focusedAriaLabel()).toMatch(/^Trial C\b/);
  });
});

test.describe("Cross-row selection drives the Data panel", () => {
  // Scenario 9: selecting a cross row scopes the phenotype pie to that cross; deselecting it
  // returns the pie to the all-crosses aggregate. Two same-fungus-state crosses are sufficient to
  // exercise the scoping (fungus locks at the first cross). The pie's aria-label carries the
  // current scope ("for cross 1" / "for cross 2" / "for all crosses"), which is the deterministic
  // signal here (the exact percentages are RNG-driven).
  test("selecting a cross scopes the pie; deselecting restores the aggregate", async () => {
    await bananas.pickParents(BASELINE_CROSS.p1, BASELINE_CROSS.p2); // fungus stays off
    await bananas.crossPlants();
    await bananas.crossPlants();
    await expect(bananas.offspringRows).toHaveCount(2);

    // No selection yet → aggregate scope.
    await expect(bananas.phenotypePie).toHaveAttribute("aria-label", /for all crosses/i);

    await bananas.selectCross(0);
    await expect(bananas.phenotypePie).toHaveAttribute("aria-label", /for cross 1/i);

    await bananas.selectCross(1);
    await expect(bananas.phenotypePie).toHaveAttribute("aria-label", /for cross 2/i);

    // Click the selected row again to deselect → back to the aggregate.
    await bananas.selectCross(1);
    await expect(bananas.phenotypePie).toHaveAttribute("aria-label", /for all crosses/i);
  });
});

test.describe("Pill chip click-to-scroll", () => {
  // Scenario 10: with the grid full (MAX_CROSSES) and scrolled to the bottom, the Data-panel pill
  // chip for a selected early cross scrolls that row back into view.
  test("the pill chip scrolls an off-screen selected cross back into view", async () => {
    await bananas.pickParents(BASELINE_CROSS.p1, BASELINE_CROSS.p2);
    for (let i = 0; i < MAX_CROSSES; i++) await bananas.crossPlants();
    await expect(bananas.offspringRows).toHaveCount(MAX_CROSSES);

    // Select the first cross (Playwright scrolls it into view to click it), which surfaces the chip.
    await bananas.selectCross(0);
    await expect(bananas.pillChip).toBeVisible();

    // Scroll the grid away so the first row leaves the viewport…
    await bananas.scrollOffspringGridToBottom();
    await expect(bananas.offspringRows.first()).not.toBeInViewport();

    // …then the chip click brings it back.
    await bananas.pillChip.click();
    await expect(bananas.offspringRows.first()).toBeInViewport();
  });
});

test.describe("Max trials", () => {
  // Scenario 11: filling all MAX_TRIALS slots (via the user-facing "+ New" card) replaces the card
  // with the "max reached" notice.
  test("the + New card becomes the max-trials notice at the cap", async () => {
    // Start with A; add the remaining MAX_TRIALS - 1 via repeated "+ New" clicks.
    for (let i = 0; i < MAX_TRIALS - 1; i++) await bananas.addTrial();

    await expect(bananas.newTrialCard).toHaveCount(0);
    await expect(bananas.maxTrialsNotice).toBeVisible();
  });
});

test.describe("Status pill text variants", () => {
  // Scenario 12: the status pill is absent pre-parents, prompts to cross once both are picked, and
  // shows the crosses/offspring tally once crosses exist.
  test("the status pill text tracks the trial state transitions", async () => {
    await expect(bananas.statusPill).toBeHidden(); // no pill before both parents

    await bananas.pickParents(BASELINE_CROSS.p1, BASELINE_CROSS.p2); // fungus off
    await expect(bananas.statusPill).toBeVisible();
    await expect(bananas.statusPill).toContainText("Click Cross Plants to see their offspring");

    await bananas.crossPlants();
    await expect(bananas.statusPill).toContainText("Crosses: 1");
    await expect(bananas.statusPill).toContainText(/Offspring: \d+/);
  });
});

test.describe("Disabled-state transitions", () => {
  // Scenario 13: Cross Plants is disabled until both parents are picked; Reset Trial is disabled
  // while the trial is clean. The shared Button signals disabled via aria-disabled (staying
  // keyboard-focusable), not a native disabled attribute.
  test("Cross Plants and Reset Trial enable as the trial gains state", async () => {
    // Clean trial: both disabled.
    await expect(bananas.crossPlantsButton).toHaveAttribute("aria-disabled", "true");
    await expect(bananas.resetTrialButton).toHaveAttribute("aria-disabled", "true");

    // One parent: the trial now has state → Reset enables; Cross still needs the second parent.
    await bananas.pickParent1(BASELINE_CROSS.p1);
    await expect(bananas.resetTrialButton).toBeEnabled();
    await expect(bananas.crossPlantsButton).toHaveAttribute("aria-disabled", "true");

    // Second parent: Cross Plants enables.
    await bananas.pickParent2(BASELINE_CROSS.p2);
    await expect(bananas.crossPlantsButton).toBeEnabled();
  });
});
