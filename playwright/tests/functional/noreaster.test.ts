import { expect, test } from "@playwright/test";
import { NoreasterPage } from "../../pages/noreaster-page";

// Nor'easter functional spec: NoreasterPage owns every locator, each test starts from a fresh `sim.goto()`,
// runs once per viewport project). Covers trial-card body — per-trial content + independence, plus the
// layout facts jsdom can't prove (the custom footprint and the reset-button position math).

// The Nor'easter trial-card footprint. Duplicates trials-panel.scss's `--trial-card-height` because a
// browser-level assertion needs the value in TS (jsdom can't read SCSS) — keep the two in sync.
const CARD_HEIGHT = 213;

/** Do two vertical boxes overlap on the y-axis? */
function overlapsVertically(
  a: { y: number; height: number },
  b: { y: number; height: number },
): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height;
}

let sim: NoreasterPage;

test.beforeEach(async ({ page }) => {
  sim = new NoreasterPage(page);
  await sim.goto();
});

test.describe("Trial cards — content and independence", () => {
  test("a run trial shows its outcome; resetting it clears only that card", async () => {
    // Run trial A → its card body shows the outcome banner.
    await sim.completeSetup("strong");
    await sim.runButton.click();
    await expect(sim.trialCardOutcome("A")).toContainText("Strong");

    // Add B and give it a partial configuration: one air-mass section, no banner (not yet run).
    await sim.addTrial();
    await sim.selectOption("Pathway for Land Air Mass", "1 N/NW");
    await expect(sim.trialCardSections("B")).toHaveCount(1);
    await expect(sim.trialCardOutcome("B")).toHaveCount(0);

    // Reset A via its panel reset: A's body empties while B's content is preserved.
    await sim.selectTrial("A");
    await sim.trialResetButton("A").click();
    await expect(sim.trialCardOutcome("A")).toHaveCount(0);
    await expect(sim.trialCardSections("A")).toHaveCount(0);
    await expect(sim.trialCardSections("B")).toHaveCount(1);
  });

  test("A and B hold independent outcomes; selecting each loads its state", async () => {
    // A = strong, B = fair — two distinct recorded outcomes.
    await sim.completeSetup("strong");
    await sim.runButton.click();
    await sim.addTrial(); // B, auto-selected
    await sim.completeSetup("fair");
    await sim.runButton.click();

    // Both cards show their own banner simultaneously — neither overwrote the other.
    await expect(sim.trialCardOutcome("A")).toContainText("Strong");
    await expect(sim.trialCardOutcome("B")).toContainText("Fair");

    // Selecting a card loads its recorded outcome into the Data panel.
    await sim.selectTrial("A");
    await expect(sim.outcomePill).toHaveText("Strong nor’easter");
    await sim.selectTrial("B");
    await expect(sim.outcomePill).toHaveText("Fair weather");
  });
});

test.describe("Trial card layout (browser-level)", () => {
  test("a trial card and the + New card match the panel's card height", async () => {
    const cardBox = await sim.trialCardWrapper("A").boundingBox();
    const newBox = await sim.newTrialCard.boundingBox();
    expect(cardBox?.height).toBeCloseTo(CARD_HEIGHT, 0);
    expect(newBox?.height).toBeCloseTo(CARD_HEIGHT, 0);
  });

  test("the panel reset overhangs the selected (non-first) card, not the row above it", async () => {
    // Build A–D and select D (index 3): a non-first row, so any accumulated per-row offset error in
    // the reset-position formula would surface here rather than staying hidden at row 1.
    await sim.addTrial(); // B
    await sim.addTrial(); // C
    await sim.addTrial(); // D
    await sim.selectTrial("D");
    await sim.selectOption("Pathway for Land Air Mass", "1 N/NW"); // progress → reset enabled

    const reset = await sim.trialResetButton("D").boundingBox();
    const cardD = await sim.trialCardWrapper("D").boundingBox();
    const cardC = await sim.trialCardWrapper("C").boundingBox();
    if (!reset || !cardD || !cardC) throw new Error("expected bounding boxes for reset, C and D");

    // The reset box vertically overlaps the selected card D…
    expect(overlapsVertically(reset, cardD)).toBe(true);
    // …and NOT card C, the row above — it tracks the selected card by index, not a fixed position.
    expect(overlapsVertically(reset, cardC)).toBe(false);
  });
});
