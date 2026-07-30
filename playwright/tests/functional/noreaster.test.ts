import { expect, test } from "@playwright/test";
import { NoreasterPage } from "../../pages/noreaster-page";

// Nor'easter functional spec: NoreasterPage owns every locator, each test starts from a fresh `sim.goto()`,
// runs once per viewport project. Covers trial-card body — per-trial content + independence, plus the
// layout facts jsdom can't prove (the custom footprint and the reset-button position math).

// The Run animation defers the outcome (up to ~11.5 s). These tests assert the recorded outcome, so run
// under reduced motion — the runner finalizes at once, reaching the post-run state instantly.
test.use({ contextOptions: { reducedMotion: "reduce" } });

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

    // Add B and give it a partial configuration: one populated air mass (the land glyph), no banner.
    await sim.addTrial();
    await sim.selectOption("Pathway for Land Air Mass", "1 N/NW");
    await expect(sim.trialCardGlyphs("B")).toHaveCount(1); // only the land air mass populated
    await expect(sim.trialCardSections("B")).toHaveCount(2); // both sections render (Land + empty Ocean)
    await expect(sim.trialCardOutcome("B")).toHaveCount(0);

    // Reset A via its panel reset: A's body empties (no glyphs/sections, and its accessible name falls
    // back to the bare letter) while B's content is preserved.
    await sim.selectTrial("A");
    await sim.trialResetButton("A").click();
    await expect(sim.trialCardOutcome("A")).toHaveCount(0);
    await expect(sim.trialCardGlyphs("A")).toHaveCount(0);
    await expect(sim.trialCardSections("A")).toHaveCount(0); // empty trial → no sections
    await expect(sim.trialOption("A")).toHaveAttribute("aria-label", "Trial A");
    await expect(sim.trialCardGlyphs("B")).toHaveCount(1);
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

    // The visible body isn't exposed to assistive tech, so the enriched card name is the only channel —
    // assert it carries A's full settings + outcome in a real browser (the exact-string unit test can't).
    await expect(sim.trialOption("A")).toHaveAttribute(
      "aria-label",
      "Trial A. Land: N/NW, Dry, Cold. Ocean: S/SE, Humid, Warm. Strong nor’easter",
    );

    // Selecting a card loads its recorded outcome into the Data panel.
    await sim.selectTrial("A");
    await expect(sim.outcomePill).toHaveText("Strong nor’easter");
    await sim.selectTrial("B");
    await expect(sim.outcomePill).toHaveText("Fair weather");
  });
});

test.describe("Trial card layout (browser-level)", () => {
  test("an ocean-only trial reserves the empty Land slot on top", async () => {
    // A childless Land section must still occupy its row height (from `.nor-card-am-section`'s fixed
    // grid rows) so the Ocean section stays in the bottom slot. jsdom has no layout, so this can only
    // be proven in a real browser.
    await sim.selectOption("Pathway for Ocean Air Mass", "2 S/SE");
    await sim.selectOption("Humidity for Ocean Air Mass", "Humid");

    const sections = sim.trialCardSections("A");
    await expect(sections).toHaveCount(2);
    const landBox = await sections.nth(0).boundingBox();
    const oceanBox = await sections.nth(1).boundingBox();
    if (!landBox || !oceanBox)
      throw new Error("expected bounding boxes for the Land and Ocean sections");

    // The empty Land slot (top) has real height ≈ the populated Ocean section, and sits above it.
    expect(landBox.height).toBeGreaterThan(0);
    expect(landBox.height).toBeCloseTo(oceanBox.height, 0);
    expect(landBox.y).toBeLessThan(oceanBox.y);
  });

  test("a trial card and the + New card match the panel's declared card height", async () => {
    const declared = await sim.cardHeightProperty();
    expect(declared).not.toBe(""); // the sim declares the override (else the shared default applies)
    const expectedHeight = Number.parseFloat(declared);

    const cardBox = await sim.trialCardWrapper("A").boundingBox();
    const newBox = await sim.newTrialCard.boundingBox();
    if (!cardBox || !newBox) {
      throw new Error("expected bounding boxes for trial card A and + New card");
    }
    expect(cardBox.height).toBeCloseTo(expectedHeight, 0);
    expect(newBox.height).toBeCloseTo(expectedHeight, 0);
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
