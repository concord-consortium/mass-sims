/**
 * Data-panel weather-scene performance probe — a DIAGNOSTIC, not a CI gate.
 *
 * It lives under `playwright/diagnostics/` (outside `testDir: ./playwright/tests`), so `yarn
 * test:playwright` never runs it. It opens the BUILT sim, drives each of the six outcomes, CPU-throttles via
 * CDP (`Emulation.setCPUThrottlingRate`), samples in-page `requestAnimationFrame` frame intervals for a few
 * seconds, and prints median / p95 / max frame time + a long-frame count per scene — an objective,
 * re-runnable check against the target thresholds (median ≤ 20 ms, p95 ≤ 32 ms at 4–6× throttle).
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

// noreaster's preview (production build) port — NOT :8080, which is the dev server.
const BASE_URL = process.argv[2] ?? "http://localhost:8082/";
const SAMPLE_MS = Number(process.argv[3] ?? 4000);
// A bad sampleMs would otherwise fail silently: `Infinity` makes the in-page rAF sampler run forever, while
// NaN / 0 / negative resolve it immediately with empty metrics and a table of NaNs that still exits 0.
if (!Number.isFinite(SAMPLE_MS) || SAMPLE_MS <= 0) {
  console.error(`Invalid sampleMs "${process.argv[3]}" — must be a finite positive number of ms.`);
  process.exit(1);
}
const THROTTLE_RATES = [4, 6];

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
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  const browser = await chromium.launch();
  // deviceScaleFactor 2 stresses raster like an iPad/Chromebook (the DPR clamp caps the backing store at 2).
  const context = await browser.newContext({
    viewport: { width: 1044, height: 700 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);

  const rows: {
    scene: string;
    rate: number;
    count: number;
    median: number;
    p95: number;
    max: number;
    long: number;
  }[] = [];

  for (const rate of THROTTLE_RATES) {
    for (const [outcome, picks] of Object.entries(SETUPS)) {
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      for (let i = 0; i < FIELDS.length; i++) {
        await page.getByRole("button", { name: new RegExp(FIELDS[i]) }).click();
        await page.getByRole("option", { name: picks[i], exact: true }).click();
      }
      await page.getByRole("button", { name: "Run", exact: true }).click();
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

  await browser.close();

  const f = (n: number) => n.toFixed(1).padStart(7);
  console.log(`\nWeather-scene perf — ${BASE_URL}  (sample ${SAMPLE_MS}ms/scene, DPR 2)`);
  console.log("thresholds: median ≤ 20ms, p95 ≤ 32ms\n");
  console.log("scene           throttle  frames  median     p95     max   >32ms   verdict");
  for (const r of rows) {
    const ok = r.median <= 20 && r.p95 <= 32;
    console.log(
      `${r.scene.padEnd(15)} ${String(r.rate).padStart(2)}x   ${String(r.count).padStart(6)}  ${f(r.median)} ${f(r.p95)} ${f(r.max)}  ${String(r.long).padStart(5)}   ${ok ? "PASS" : "MISS"}`,
    );
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
