import { expect, test } from "@playwright/test";
import { NoreasterPage } from "../../pages/noreaster-page";

// Nor'easter storm-cloud consistency (MAS-50): every rendering of an outcome must show the same cloud.
// These tests need the real animation (not reduced motion, which skips it), so they live apart from
// noreaster.test.ts. A strong run animates for ~11.5 s.

let sim: NoreasterPage;

test.beforeEach(async ({ page }) => {
  sim = new NoreasterPage(page);
  await sim.goto();
});

test("the storm cloud is identical after switching trials and across runs of the same outcome", async ({
  page,
}) => {
  test.slow();

  // Run trial A to its end and capture the frame the animation ended on.
  await sim.completeSetup("strong");
  await sim.runButton.click();
  await expect(sim.mapStage).toHaveAttribute("data-run-phase", "done", { timeout: 30_000 });
  const ended = await sim.stormPixelsHash();
  // Every check below compares against `ended`, so make sure it isn't an empty canvas.
  expect(await sim.stormHasPaint()).toBe(true);

  // Add trial B (selects it, no cloud), then select A again: the restored cloud is the ended frame.
  await sim.addTrial();
  await expect(sim.trialOption("B")).toHaveAttribute("aria-selected", "true");
  await sim.selectTrial("A");
  await expect(sim.mapStage).toHaveAttribute("data-run-phase", "done");
  expect(await sim.stormPixelsHash()).toBe(ended);

  // Run trial B with the same setup: its animation ends on the same cloud as A's.
  await sim.selectTrial("B");
  await sim.completeSetup("strong");
  await sim.runButton.click();
  await expect(sim.mapStage).toHaveAttribute("data-run-phase", "done", { timeout: 30_000 });
  expect(await sim.stormPixelsHash()).toBe(ended);

  // A reduced-motion run on a fresh page (empty cache) draws its cloud with renderFinal: same frame.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await sim.goto();
  await sim.completeSetup("strong");
  await sim.runButton.click();
  await expect(sim.mapStage).toHaveAttribute("data-run-phase", "done");
  expect(await sim.stormPixelsHash()).toBe(ended);
});
