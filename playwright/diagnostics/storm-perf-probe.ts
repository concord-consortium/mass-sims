/**
 * Nor'easter map-area storm performance probe — a diagnostic, not a CI gate.
 *
 * Measures the heavy map-area storm (the fixed two-blur-pass cloud canvas). It samples three things:
 *   (a) the live rAF loop per cloud outcome with the storm HELD at its end, under CDP CPU throttle, at both
 *       target-width extremes. The physics runs fixed steps on the run clock, so a held storm runs every
 *       step on its first frame and then only redraws the finished cloud: these rows measure DRAWING the
 *       finished cloud, with no physics. They are not the worst case — (b) is;
 *   (b) REAL runs (no hold), repeated, reporting the late window (the last 2 s of the cloud, in the
 *       runner's clock) and the worst single frame — the climax, and any physics catch-up frames; and
 *   (c) `renderFinal` first-generation latency — the synchronous re-sim that stalls the main thread on
 *       restore / hydration / reduced motion.
 *
 * The `__norPerf` flag (set by this probe via addInitScript, so it's never reachable from a production
 * URL) holds the storm at its end and suppresses auto-finalize, so (a) samples the sustained draw cost of
 * the finished cloud. The run must be live before sampling, or it fails loudly rather than measuring an
 * idle page.
 * The `__norPerfTrace` flag (set the same way) leaves the run alone but has the runner record each cloud
 * frame's `{ cloudElapsedMs, frameMs }`, so (b) can select frames by the runner's clock — which moves
 * slower than wall time on a throttled run, since the runner clamps each frame's clock advance.
 * Each entry's `frameMs` is the gap since the previous frame, so it measures the previous tick's work. The
 * last tick's own work (the last steps, the cache copy, finalize) is not measured: no later frame records it.
 *
 * Measured results, and the options if the storm is too slow on real devices:
 * simulations/noreaster/STORM-PERFORMANCE.md.
 *
 * Measure the production build, not the dev server (dev is unminified React and not representative):
 *   yarn workspace noreaster build && yarn workspace noreaster preview --port 8082 --strictPort
 * Then run (Node ≥ 24 strips the TS types):
 *   node playwright/diagnostics/storm-perf-probe.ts [baseUrl] [sampleMs]
 */
import { type CDPSession, chromium, type Page } from "@playwright/test";
// target-widths.ts is pure (no side-effects), so Node's type-stripping loads it directly with the
// explicit extension — the tested dimensions stay tied to the single source of truth.
import { FRAME_HEIGHT, TARGET_WIDTH_PX } from "../../packages/shared/src/layout/target-widths.ts";
// Same for run-timing.ts (its only import is type-only, which type-stripping erases).
import { TOTAL_DUR_S } from "../../simulations/noreaster/src/animation/run-timing.ts";

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

// Real-run repeats per (width, scene, throttle), and the late window measured at the end of the cloud.
const REAL_RUNS = 5;
const LATE_WINDOW_MS = 2000;
/** The cloud starts this far into the run (mirrors `CLOUD_START_MS` in use-storm-run.ts). */
const CLOUD_START_S = 1.5;

// Thresholds: sustained ~50 fps, no worse than ~30 fps tail.
const MEDIAN_BUDGET_MS = 20;
const P95_BUDGET_MS = 32;
/**
 * `renderFinal` max per outcome (unthrottled). Measured `strong` (the heaviest) at a 60.9 ms max for MAS-50,
 * plus ~25% headroom — catches a real regression without failing on normal noise.
 */
const RENDER_FINAL_BUDGET_MS = 76;

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

/** Pick one option in each of the five air-mass selectors. */
async function pickSetup(page: Page, picks: readonly string[]): Promise<void> {
  for (let i = 0; i < FIELDS.length; i++) {
    await page.getByRole("button", { name: new RegExp(FIELDS[i]) }).click();
    await page.getByRole("option", { name: picks[i], exact: true }).click();
  }
}

/** Configure the five selectors and start the (held) run. Throws if the storm isn't live afterward. */
async function startHeldRun(page: Page, picks: readonly string[]): Promise<void> {
  await pickSetup(page, picks);
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

interface FrameTraceEntry {
  cloudElapsedMs: number;
  frameMs: number;
}

/**
 * One real (unheld) traced run under `rate`× CPU throttle: pick the setup unthrottled, then throttle, Run,
 * and wait for the run to finish. Returns the runner's per-frame trace. Throws if the run never finishes or
 * the trace is empty (the flag didn't take, or the selectors drifted).
 */
async function tracedRun(
  page: Page,
  cdp: CDPSession,
  picks: readonly string[],
  rate: number,
): Promise<FrameTraceEntry[]> {
  await pickSetup(page, picks);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  try {
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await page.waitForSelector('.nor-stage[data-run-phase="running"]', { timeout: 10000 });
    await page.waitForSelector('.nor-stage[data-run-phase="done"]', { timeout: 120000 });
  } finally {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }
  const trace = await page.evaluate(
    () => (window as { __norFrameTrace?: FrameTraceEntry[] }).__norFrameTrace ?? [],
  );
  if (trace.length === 0) throw new Error("real run produced an empty frame trace");
  return trace;
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
    // deviceScaleFactor 2 mirrors an iPad/Chromebook display path.
    const context = await browser.newContext({
      viewport: { width, height: FRAME_HEIGHT },
      deviceScaleFactor: 2,
    });
    // Enable the sim's diagnostic hold via a window flag set before any page script — never the URL.
    await context.addInitScript(() => {
      (window as unknown as { __norPerf?: boolean }).__norPerf = true;
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);

    for (const rate of THROTTLE_RATES) {
      for (const [scene, picks] of Object.entries(SETUPS)) {
        await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
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

  // Real runs (no hold), repeated: per run, the late-window median/p95 (by the runner's clock) and the
  // worst single frame of the whole cloud.
  const realRows: {
    width: number;
    scene: string;
    rate: number;
    lateFrames: number;
    lateMedian: number;
    lateP95: number;
    worst: number[];
  }[] = [];
  for (const width of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: FRAME_HEIGHT },
      deviceScaleFactor: 2,
    });
    await context.addInitScript(() => {
      (window as unknown as { __norPerfTrace?: boolean }).__norPerfTrace = true;
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);

    for (const rate of THROTTLE_RATES) {
      for (const [scene, picks] of Object.entries(SETUPS)) {
        const durationMs = (TOTAL_DUR_S[scene as keyof typeof TOTAL_DUR_S] - CLOUD_START_S) * 1000;
        const lateCounts: number[] = [];
        const lateMedians: number[] = [];
        const lateP95s: number[] = [];
        const worst: number[] = [];
        for (let run = 0; run < REAL_RUNS; run++) {
          await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
          const trace = await tracedRun(page, cdp, picks, rate);
          // No upper bound: the last tick's clock can overshoot durationMs, and the trace stops at finalize.
          const late = trace
            .filter((e) => e.cloudElapsedMs >= durationMs - LATE_WINDOW_MS)
            .map((e) => e.frameMs)
            .sort((a, b) => a - b);
          if (late.length === 0) throw new Error(`no late-window frames for "${scene}"`);
          lateCounts.push(late.length);
          lateMedians.push(pct(late, 50));
          lateP95s.push(pct(late, 95));
          worst.push(Math.max(...trace.map((e) => e.frameMs)));
        }
        realRows.push({
          width,
          scene,
          rate,
          lateFrames: median(lateCounts),
          lateMedian: median(lateMedians),
          lateP95: median(lateP95s),
          worst,
        });
      }
    }

    await context.close();
  }

  // renderFinal first-gen latency — width-independent (fixed artboard size), so measure once per outcome at DPR 2,
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
    await context.addInitScript(() => {
      (window as unknown as { __norPerf?: boolean }).__norPerf = true;
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () =>
        typeof (window as { __norStormRenderFinalMs?: unknown }).__norStormRenderFinalMs ===
        "function",
      { timeout: 5000 },
    );
    for (const scene of Object.keys(SETUPS)) {
      const samples: number[] = [];
      for (let i = 0; i < 5; i++) {
        const ms = await page.evaluate(
          (s) =>
            (
              window as { __norStormRenderFinalMs?: (o: string) => number | null }
            ).__norStormRenderFinalMs?.(s) ?? Number.NaN,
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
  console.log(
    `\nStorm perf — ${BASE_URL}  (sample ${SAMPLE_MS}ms/scene, DPR 2, held at the end: draw cost only, no physics)`,
  );
  console.log(`thresholds: median ≤ ${MEDIAN_BUDGET_MS}ms, p95 ≤ ${P95_BUDGET_MS}ms\n`);
  console.log("width  scene           throttle  frames  median     p95     max   >32ms   verdict");
  for (const r of rows) {
    const ok = r.median <= MEDIAN_BUDGET_MS && r.p95 <= P95_BUDGET_MS;
    console.log(
      `${String(r.width).padStart(4)}   ${r.scene.padEnd(15)} ${String(r.rate).padStart(2)}x   ${String(r.count).padStart(6)}  ${f(r.median)} ${f(r.p95)} ${f(r.max)}  ${String(r.long).padStart(5)}   ${ok ? "PASS" : "MISS"}`,
    );
  }
  console.log(
    `\nReal runs (no hold, DPR 2, ${REAL_RUNS} runs each) — late window = last ${LATE_WINDOW_MS}ms of the cloud by the runner's clock.`,
  );
  console.log(
    "late median / late p95 = median over the runs; worst = each run's worst single frame.\n",
  );
  console.log(
    "width  scene           throttle  late-frames  late-median  late-p95   worst (per run)",
  );
  for (const r of realRows) {
    console.log(
      `${String(r.width).padStart(4)}   ${r.scene.padEnd(15)} ${String(r.rate).padStart(2)}x   ${String(r.lateFrames).padStart(11)}  ${f(r.lateMedian).padStart(11)} ${f(r.lateP95).padStart(9)}   ${r.worst.map((w) => w.toFixed(0)).join(" ")}`,
    );
  }
  console.log(
    `\nrenderFinal first-gen latency (unthrottled, DPR 2) — budget: max ≤ ${RENDER_FINAL_BUDGET_MS}ms:`,
  );
  console.log("scene            median     max   verdict");
  for (const r of finalRows) {
    const ok = r.max <= RENDER_FINAL_BUDGET_MS;
    console.log(`${r.scene.padEnd(15)} ${f(r.median)} ${f(r.max)}   ${ok ? "PASS" : "MISS"}`);
  }
  console.log("");

  // A live-loop MISS, a renderFinal over budget, and a renderFinal that produced no samples all fail the
  // run — without `finalFailed` here, this line would clobber the in-loop failure back to 0 whenever the
  // rows all pass.
  const anyRowMiss = rows.some((r) => !(r.median <= MEDIAN_BUDGET_MS && r.p95 <= P95_BUDGET_MS));
  const anyFinalMiss = finalRows.some((r) => !(r.max <= RENDER_FINAL_BUDGET_MS));
  process.exitCode = anyRowMiss || anyFinalMiss || finalFailed ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
