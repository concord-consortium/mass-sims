/**
 * Data-panel weather-scene performance probe — a DIAGNOSTIC, not a CI gate.
 *
 * It lives under `playwright/diagnostics/` (outside `testDir: ./playwright/tests`), so `yarn
 * test:playwright` never runs it. It opens the BUILT sim, drives each of the six outcomes, CPU-throttles via
 * CDP (`Emulation.setCPUThrottlingRate`), samples in-page `requestAnimationFrame` frame intervals for a few
 * seconds, and prints median / p95 / max frame time + a long-frame count per scene — an objective,
 * re-runnable check against the target thresholds (median ≤ 20 ms, p95 ≤ 32 ms at 4–6× throttle).
 *
 * It runs each scene at the two extreme target widths (widest = most raster pixels, narrowest = tightest
 * layout) at the real iframe height, so whichever width is worst-case is covered. On any scene over threshold
 * it exits non-zero, so `node perf-probe.ts && …` can gate on it.
 *
 * Measure the PRODUCTION build, not the dev server. Build then preview:
 *   yarn workspace noreaster build && yarn workspace noreaster preview --port 8082 --strictPort
 * Then run (Node ≥ 24 strips the TS types):
 *   node playwright/diagnostics/perf-probe.ts [baseUrl] [sampleMs]
 *
 * Port 8082 is noreaster's registry/preview port and the default below. Do NOT point this at the dev server
 * on :8080 — that's unminified, dev-mode React and not representative (and, being slower, can false-fail).
 */
import { chromium } from "@playwright/test";
// target-widths.ts is pure (no side-effects), so Node's type-stripping loads it directly with the explicit
// extension — the tested dimensions stay tied to the single source of truth.
import { FRAME_HEIGHT, TARGET_WIDTH_PX } from "../../packages/shared/src/layout/target-widths.ts";

// noreaster's preview (production build) port — NOT :8080, which is the dev server.
const BASE_URL = process.argv[2] ?? "http://localhost:8082/";
const SAMPLE_MS = Number(process.argv[3] ?? 4000);

// Validate the sampleMs arg up front, since a bad value fails silently rather than erroring: `Infinity`
// makes the in-page rAF sampler run forever, while NaN / 0 / negative resolve it immediately with empty
// metrics and a table of NaNs that still exits 0.
if (!Number.isFinite(SAMPLE_MS) || SAMPLE_MS <= 0) {
  console.error(`Invalid sampleMs "${process.argv[3]}" — must be a finite positive number of ms.`);
  process.exit(1);
}

const THROTTLE_RATES = [4, 6];
// The extremes of the target-width matrix at the fixed iframe height: widest maximizes canvas raster,
// narrowest the tightest layout. Whichever is worse for a given scene, one of these two catches it.
const WIDTHS = [Math.max(...TARGET_WIDTH_PX), Math.min(...TARGET_WIDTH_PX)];

// Field labels + the five picks per outcome (mirrors the e2e page object / test fixtures).
const FIELDS = [
  "Pathway for Land Air Mass",
  "Humidity for Land Air Mass",
  "Temperature for Land Air Mass",
  "Pathway for Ocean Air Mass",
  "Humidity for Ocean Air Mass",
] as const;
const SETUPS: Record<string, [string, string, string, string, string]> = {
  strong: ["1 N/NW", "Dry", "Cold", "2 S/SE", "Humid"],
  moderate: ["4 W", "Dry", "Cold", "2 S/SE", "Humid"],
  weakCoastal: ["1 N/NW", "Dry", "Cold", "3 NE", "Humid"],
  humidNoStorm: ["1 N/NW", "Humid", "Cold", "2 S/SE", "Humid"],
  windy: ["1 N/NW", "Dry", "Cold", "2 S/SE", "Dry"],
  fair: ["1 N/NW", "Humid", "Cold", "2 S/SE", "Dry"],
};

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  // Nearest-rank: the p-th percentile is the ⌈p/100 · n⌉-th value (1-based), so index = that minus 1.
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

async function main() {
  const browser = await chromium.launch();

  const rows: {
    width: number;
    scene: string;
    rate: number;
    count: number;
    median: number;
    p95: number;
    max: number;
    long: number;
  }[] = [];

  for (const width of WIDTHS) {
    // deviceScaleFactor 2 stresses raster like an iPad/Chromebook (the DPR clamp caps the backing store at 2).
    const context = await browser.newContext({
      viewport: { width, height: FRAME_HEIGHT },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);

    for (const rate of THROTTLE_RATES) {
      for (const [outcome, picks] of Object.entries(SETUPS)) {
        await page.goto(BASE_URL, { waitUntil: "networkidle" });
        for (let i = 0; i < FIELDS.length; i++) {
          await page.getByRole("button", { name: new RegExp(FIELDS[i]) }).click();
          await page.getByRole("option", { name: picks[i], exact: true }).click();
        }
        await page.getByRole("button", { name: "Run", exact: true }).click();
        // Confirm the expected scene actually rendered before sampling — catches a setup/scene-name drift
        // that would otherwise silently measure the wrong (or a "default", particle-less) backdrop.
        await page.waitForSelector(`.wo-scene[data-scene="${outcome}"]`, { timeout: 5000 });
        await page.waitForTimeout(400); // let the scene settle past its first spawns

        await cdp.send("Emulation.setCPUThrottlingRate", { rate });
        const intervals: number[] = await page.evaluate(
          (dur) =>
            new Promise<number[]>((resolve) => {
              const out: number[] = [];
              let last = performance.now();
              const start = last;
              const tick = (now: number) => {
                out.push(now - last);
                last = now;
                if (now - start < dur) requestAnimationFrame(tick);
                else resolve(out.slice(1)); // drop the first (warm-up) delta
              };
              requestAnimationFrame(tick);
            }),
          SAMPLE_MS,
        );
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

        const sorted = [...intervals].sort((a, b) => a - b);
        rows.push({
          width,
          scene: outcome,
          rate,
          count: intervals.length,
          median: pct(sorted, 50),
          p95: pct(sorted, 95),
          max: sorted[sorted.length - 1] ?? Number.NaN,
          long: intervals.filter((t) => t > 32).length, // frames over the p95 budget
        });
      }
    }

    await context.close();
  }

  await browser.close();

  const f = (n: number) => n.toFixed(1).padStart(7);
  console.log(`\nWeather-scene perf — ${BASE_URL}  (sample ${SAMPLE_MS}ms/scene, DPR 2)`);
  console.log("thresholds: median ≤ 20ms, p95 ≤ 32ms\n");
  console.log("width  scene           throttle  frames  median     p95     max   >32ms   verdict");
  for (const r of rows) {
    const ok = r.median <= 20 && r.p95 <= 32;
    console.log(
      `${String(r.width).padStart(4)}   ${r.scene.padEnd(15)} ${String(r.rate).padStart(2)}x   ${String(r.count).padStart(6)}  ${f(r.median)} ${f(r.p95)} ${f(r.max)}  ${String(r.long).padStart(5)}   ${ok ? "PASS" : "MISS"}`,
    );
  }
  console.log("");

  // Non-zero exit if any scene missed threshold, so this can gate a script (`node perf-probe.ts && …`).
  process.exitCode = rows.some((r) => !(r.median <= 20 && r.p95 <= 32)) ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
