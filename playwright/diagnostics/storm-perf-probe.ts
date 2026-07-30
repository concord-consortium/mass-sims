/**
 * Nor'easter map-area storm performance probe — a diagnostic, not a CI gate.
 *
 * Measures the heavy map-area storm (the fixed 1592² two-blur-pass cloud canvas). It samples two things:
 *   (a) the live rAF loop per cloud outcome, under CDP CPU throttle, at both target-width extremes; and
 *   (b) `renderFinal` first-generation latency — the synchronous re-sim that stalls the main thread on
 *       restore / hydration / reduced motion.
 *
 * `?perf=1` holds the storm at peak radius and suppresses auto-finalize, so we sample the worst-case
 * sustained load rather than the fleeting real peak. The run must be live before sampling, or it fails
 * loudly rather than measuring an idle page.
 *
 * Measure the production build, not the dev server (dev is unminified React and not representative):
 *   yarn workspace noreaster build && yarn workspace noreaster preview --port 8082 --strictPort
 * Then run (Node ≥ 24 strips the TS types):
 *   node playwright/diagnostics/storm-perf-probe.ts [baseUrl] [sampleMs]
 */
import { chromium, type Page } from "@playwright/test";
// target-widths.ts is pure (no side-effects), so Node's type-stripping loads it directly with the
// explicit extension — the tested dimensions stay tied to the single source of truth.
import { FRAME_HEIGHT, TARGET_WIDTH_PX } from "../../packages/shared/src/layout/target-widths.ts";

const BASE_URL = process.argv[2] ?? "http://localhost:8082/";
const SAMPLE_MS = Number(process.argv[3] ?? 4000);

if (!Number.isFinite(SAMPLE_MS) || SAMPLE_MS <= 0) {
  console.error(`Invalid sampleMs "${process.argv[3]}" — must be a finite positive number of ms.`);
  process.exit(1);
}

const THROTTLE_RATES = [4, 6];
// The extremes of the target-width matrix at the fixed iframe height (the storm backing store is fixed,
// but the widest crops least / narrowest most, and both stress the browser display path at DPR 2).
const WIDTHS = [Math.max(...TARGET_WIDTH_PX), Math.min(...TARGET_WIDTH_PX)];

// Thresholds: sustained ~50 fps, no worse than ~30 fps tail.
const MEDIAN_BUDGET_MS = 20;
const P95_BUDGET_MS = 32;

const FIELDS = [
  "Pathway for Land Air Mass",
  "Humidity for Land Air Mass",
  "Temperature for Land Air Mass",
  "Pathway for Ocean Air Mass",
  "Humidity for Ocean Air Mass",
] as const;

// The four cloud outcomes (windy/fair have no storm), with the five picks that yield each.
const SETUPS: Record<string, [string, string, string, string, string]> = {
  strong: ["1 N/NW", "Dry", "Cold", "2 S/SE", "Humid"],
  moderate: ["4 W", "Dry", "Cold", "2 S/SE", "Humid"],
  weakCoastal: ["1 N/NW", "Dry", "Cold", "3 NE", "Humid"],
  humidNoStorm: ["1 N/NW", "Humid", "Cold", "2 S/SE", "Humid"],
};

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function median(values: number[]): number {
  return pct(
    [...values].sort((a, b) => a - b),
    50,
  );
}

/** Configure the five selectors and start the (held) run. Throws if the storm isn't live afterward. */
async function startHeldRun(page: Page, picks: readonly string[]): Promise<void> {
  for (let i = 0; i < FIELDS.length; i++) {
    await page.getByRole("button", { name: new RegExp(FIELDS[i]) }).click();
    await page.getByRole("option", { name: picks[i], exact: true }).click();
  }
  await page.getByRole("button", { name: "Run", exact: true }).click();
  // The hold keeps the run in the "running" phase; wait for it, then for the storm container to actually
  // paint (the runner sets its opacity to 1 on the first drawn frame). Fail loudly if neither happens —
  // that means the setup/selectors drifted and we'd otherwise measure an idle page.
  await page.waitForSelector('.nor-stage[data-run-phase="running"]', { timeout: 5000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector<HTMLElement>(".nor-storm");
      return !!el && el.style.opacity === "1";
    },
    { timeout: 5000 },
  );
  await page.waitForTimeout(2200); // let the 2 s arrow convergence finish, so we sample pure storm cost
}

async function sampleFrames(page: Page, durMs: number): Promise<number[]> {
  return page.evaluate(
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
    durMs,
  );
}

async function main() {
  const browser = await chromium.launch();
  const perfUrl = `${BASE_URL + (BASE_URL.includes("?") ? "&" : "?")}perf=1`;

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
    // deviceScaleFactor 2 mirrors an iPad/Chromebook display path.
    const context = await browser.newContext({
      viewport: { width, height: FRAME_HEIGHT },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);

    for (const rate of THROTTLE_RATES) {
      for (const [scene, picks] of Object.entries(SETUPS)) {
        await page.goto(perfUrl, { waitUntil: "networkidle" });
        await startHeldRun(page, picks);

        await cdp.send("Emulation.setCPUThrottlingRate", { rate });
        const intervals = await sampleFrames(page, SAMPLE_MS);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

        const sorted = [...intervals].sort((a, b) => a - b);
        rows.push({
          width,
          scene,
          rate,
          count: intervals.length,
          median: pct(sorted, 50),
          p95: pct(sorted, 95),
          max: sorted[sorted.length - 1] ?? Number.NaN,
          long: intervals.filter((t) => t > P95_BUDGET_MS).length,
        });
      }
    }

    await context.close();
  }

  // renderFinal first-gen latency — width-independent (fixed 1592²), so measure once per outcome at DPR 2,
  // unthrottled: the raw synchronous compute cost paid on a restore/hydration.
  const finalRows: { scene: string; median: number; max: number }[] = [];
  // A scene yielding zero finite renderFinal samples (e.g. it always threw) is a real failure, not an
  // empty row — flag it so the exit code reflects it.
  let finalFailed = false;
  {
    const context = await browser.newContext({
      viewport: { width: WIDTHS[0], height: FRAME_HEIGHT },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(perfUrl, { waitUntil: "networkidle" });
    await page.waitForFunction(
      () =>
        typeof (window as { __stormRenderFinalMs?: unknown }).__stormRenderFinalMs === "function",
      { timeout: 5000 },
    );
    for (const scene of Object.keys(SETUPS)) {
      const samples: number[] = [];
      for (let i = 0; i < 5; i++) {
        const ms = await page.evaluate(
          (s) =>
            (
              window as { __stormRenderFinalMs?: (o: string) => number | null }
            ).__stormRenderFinalMs?.(s) ?? Number.NaN,
          scene,
        );
        if (Number.isFinite(ms)) samples.push(ms);
      }
      if (samples.length === 0) {
        console.error(
          `renderFinal produced no finite samples for scene "${scene}" — a real failure.`,
        );
        finalFailed = true;
        continue;
      }
      finalRows.push({ scene, median: median(samples), max: Math.max(...samples) });
    }
    await context.close();
  }

  await browser.close();

  const f = (n: number) => n.toFixed(1).padStart(7);
  console.log(`\nStorm perf — ${BASE_URL}  (sample ${SAMPLE_MS}ms/scene, DPR 2, held at peak)`);
  console.log(`thresholds: median ≤ ${MEDIAN_BUDGET_MS}ms, p95 ≤ ${P95_BUDGET_MS}ms\n`);
  console.log("width  scene           throttle  frames  median     p95     max   >32ms   verdict");
  for (const r of rows) {
    const ok = r.median <= MEDIAN_BUDGET_MS && r.p95 <= P95_BUDGET_MS;
    console.log(
      `${String(r.width).padStart(4)}   ${r.scene.padEnd(15)} ${String(r.rate).padStart(2)}x   ${String(r.count).padStart(6)}  ${f(r.median)} ${f(r.p95)} ${f(r.max)}  ${String(r.long).padStart(5)}   ${ok ? "PASS" : "MISS"}`,
    );
  }
  console.log("\nrenderFinal first-gen latency (unthrottled, DPR 2):");
  console.log("scene            median     max");
  for (const r of finalRows) {
    console.log(`${r.scene.padEnd(15)} ${f(r.median)} ${f(r.max)}`);
  }
  console.log("");

  // Both a live-loop MISS and a renderFinal that produced no samples fail the run — without `finalFailed`
  // here, this line would clobber the in-loop failure back to 0 whenever the rows all pass.
  const anyRowMiss = rows.some((r) => !(r.median <= MEDIAN_BUDGET_MS && r.p95 <= P95_BUDGET_MS));
  process.exitCode = anyRowMiss || finalFailed ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
