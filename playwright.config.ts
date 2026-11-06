import { defineConfig, devices } from "@playwright/test";
// Pure constants module, imported directly rather than via the package barrel — the barrel pulls in
// component scss/svg side-effects this tsconfig can't resolve.
import { FRAME_HEIGHT, TARGET_WIDTH_PX } from "./packages/shared/src/layout/target-widths";
import { SIMS, TOP_TEST_PORT } from "./playwright/sims";

// Playwright config lives at the repo root so `playwright test` discovers it without --config=...`.
// Tests / page objects / testdata / the sims registry all live under./playwright.
//
// Build contract: this config NEVER builds. `webServer` entries only run `vite preview` against
// each sim's pre-built dist/, and `serve` against the pre-built top-test/ fixture (the landing
// page). `yarn test:playwright` assumes both exist; `yarn test:playwright:build` (or CI's explicit
// `yarn build:top-test` step) builds them.

// The four canonical AP allocation widths, all at height 562, from the shared source of truth
// (packages/shared/src/layout/target-widths.ts — shared with the width-preview page).
// Same specs run once per project; Playwright reports per-project pass/fail, giving
// cross-width regression coverage cheaply.
//
// The landing page runs in its own projects instead, at its own widths: the narrowest window with
// no sideways scroll (1084, from landing.scss), one where the sim is stretched, and a wide one.
const LANDING_WIDTHS = [1084, 1200, 1920];

export default defineConfig({
  testDir: "./playwright/tests",
  outputDir: "./playwright/test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Cap CI workers so the four-project matrix doesn't oversubscribe the runner.
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["html", { outputFolder: "./playwright/playwright-report", open: "never" }],
    // CI-only: GitHub annotations, plus a JSON results file that the CI report-summary step
    // (daun/playwright-report-summary) reads to post a run summary. Gated to avoid local noise.
    ...(process.env.CI
      ? ([["github"], ["json", { outputFile: "./playwright/test-results/results.json" }]] as const)
      : []),
  ],
  use: {
    // Capture a trace on first retry so CI failures are debuggable from the published report.
    trace: "on-first-retry",
  },
  // NO baseURL: specs target different sims at different ports, and a single baseURL would
  // silently route one sim's tests at another. Every page object navigates explicitly via
  // getSimUrl(name) from the registry.
  projects: [
    ...TARGET_WIDTH_PX.map((width) => ({
      name: `chromium-${width}`,
      testIgnore: /landing\//,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width, height: FRAME_HEIGHT },
      },
    })),
    ...LANDING_WIDTHS.map((width) => ({
      name: `landing-${width}`,
      testMatch: /landing\//,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width, height: 1000 },
      },
    })),
  ],
  // One preview server per registered sim, derived from the registry so ports can't drift.
  // `--strictPort` makes a port collision loud; `reuseExistingServer: false` everywhere so a
  // stray dev server can never become the target.
  webServer: [
    ...SIMS.map((sim) => ({
      command: `yarn workspace ${sim.name} preview --port ${sim.port} --strictPort`,
      port: sim.port,
      reuseExistingServer: false,
      timeout: 120_000,
    })),
    // The landing page, from the top-test fixture.
    {
      command: `yarn serve -p ${TOP_TEST_PORT} top-test`,
      port: TOP_TEST_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
