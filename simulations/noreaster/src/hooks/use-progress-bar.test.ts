import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SETUPS } from "../stores/test-helpers";
import type { NoreasterRun } from "../stores/ui-store";
import type { PillTransition } from "./use-pill-phase";
import { useProgressBar } from "./use-progress-bar";

// Stubbed pill geometry — jsdom reports 0 for offset sizes, so define them.
const H = 40; // pill height (the off-screen start width, and the left-cap offset)
const W = 200; // pill width (the sweep distance)
const FULL = H + W; // fill width at 100%

// ─── rAF stub: keep one frame pending; flushFrame runs the latest with an explicit timestamp, so the
// accumulated elapsed is deterministic (the runner clamps per-frame dt at 100 ms). ────────────────────
let rafCallbacks: Map<number, FrameRequestCallback>;
let rafSeq: number;

function flushFrame(ts: number): void {
  const entries = [...rafCallbacks.entries()];
  if (entries.length === 0) return;
  const [id, cb] = entries[entries.length - 1];
  rafCallbacks.delete(id);
  cb(ts);
}

/** Feed at least `totalMs` of elapsed time in 100 ms frames (matching the runner's clamp), establishing the clock. */
function advanceMs(totalMs: number): void {
  act(() => flushFrame(0)); // first frame establishes the clock (delta 0)
  let ts = 0;
  const steps = Math.ceil(totalMs / 100) + 1;
  for (let i = 0; i < steps; i++) {
    ts += 100;
    act(() => flushFrame(ts));
  }
}

function makeEls() {
  const fill = document.createElement("span");
  const pill = document.createElement("div");
  Object.defineProperty(pill, "offsetHeight", { value: H, configurable: true });
  Object.defineProperty(pill, "offsetWidth", { value: W, configurable: true });
  return { fill, pill };
}

const FAIR_RUN: NoreasterRun = {
  runId: 1,
  trial: "A",
  outcome: "fair",
  replay: false,
  setup: SETUPS.fair,
}; // 3 s total

// A `prefers-reduced-motion: reduce` match, for `vi.stubGlobal("matchMedia", () => REDUCED_MEDIA)`.
const REDUCED_MEDIA = {
  matches: true,
  media: "(prefers-reduced-motion: reduce)",
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
  onchange: null,
};

function driver(
  fill: HTMLElement,
  pill: HTMLElement,
  run: NoreasterRun | null,
  transition: PillTransition,
) {
  const fillRef = { current: fill };
  const pillRef = { current: pill };
  return renderHook(
    (props: { run: NoreasterRun | null; transition: PillTransition }) =>
      useProgressBar(fillRef, pillRef, props.run, props.transition),
    { initialProps: { run, transition } },
  );
}

beforeEach(() => {
  rafCallbacks = new Map();
  rafSeq = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = ++rafSeq;
    rafCallbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafCallbacks.delete(id);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useProgressBar", () => {
  it("parks the fill off-screen-left at width = pill height on run start", () => {
    const { fill, pill } = makeEls();
    driver(fill, pill, FAIR_RUN, "start");
    // The layout effect runs on mount, before any frame.
    expect(fill.style.left).toBe(`${-H}px`);
    expect(fill.style.width).toBe(`${H}px`);
    expect(fill.style.opacity).toBe("1");
  });

  it("sweeps the width outward across frames, left pinned off-screen", () => {
    const { fill, pill } = makeEls();
    driver(fill, pill, FAIR_RUN, "start");

    act(() => flushFrame(0)); // establish clock
    act(() => flushFrame(100)); // +100 ms
    const w1 = Number.parseFloat(fill.style.width);
    act(() => flushFrame(200)); // +100 ms
    const w2 = Number.parseFloat(fill.style.width);

    expect(fill.style.left).toBe(`${-H}px`);
    expect(w1).toBeGreaterThan(H); // moved past the off-screen start
    expect(w2).toBeGreaterThan(w1); // and keeps growing
    expect(w2).toBeLessThan(FULL);
  });

  it("clamps at full width (pill height + pill width) once the duration elapses", () => {
    const { fill, pill } = makeEls();
    driver(fill, pill, FAIR_RUN, "start");
    advanceMs(3000); // fair = 3 s
    expect(Number.parseFloat(fill.style.width)).toBe(FULL);
  });

  it("picks up a mid-run resize via ResizeObserver (not stale dimensions)", () => {
    // jsdom has no ResizeObserver; stub one that captures its callback so we can fire it on demand.
    let roCallback: (() => void) | null = null;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          roCallback = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const { fill, pill } = makeEls();
    driver(fill, pill, FAIR_RUN, "start");
    act(() => flushFrame(0));
    act(() => flushFrame(100)); // swept against the original 200px width

    // Shrink the pill and fire the observer; the next frame must sweep against the NEW width.
    Object.defineProperty(pill, "offsetWidth", { value: 100, configurable: true });
    act(() => roCallback?.());
    act(() => flushFrame(200));

    const p = 200 / 3000; // 200 ms elapsed of the 3 s run
    expect(Number.parseFloat(fill.style.width)).toBeCloseTo(H + p * 100, 5); // new 100px width
    expect(Number.parseFloat(fill.style.width)).toBeLessThan(H + p * 200); // NOT the stale 200px width
  });

  it("does not paint under reduced motion (the loop is disabled)", () => {
    vi.stubGlobal("matchMedia", () => REDUCED_MEDIA); // cleaned by afterEach's unstubAllGlobals
    const { fill, pill } = makeEls();
    driver(fill, pill, FAIR_RUN, "start");
    advanceMs(3000); // no frames run — the loop is gated off
    expect(fill.style.width).toBe(`${H}px`); // still the off-screen start
  });

  it("does not paint while the tab is hidden (the loop is disabled)", () => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    try {
      const { fill, pill } = makeEls();
      driver(fill, pill, FAIR_RUN, "start");
      advanceMs(3000); // no frames run — the loop is gated off while hidden
      expect(fill.style.width).toBe(`${H}px`); // still the off-screen start
    } finally {
      delete (document as { hidden?: boolean }).hidden; // restore jsdom's prototype getter (false)
    }
  });

  it("fades opacity to 0 and KEEPS the width on completion", () => {
    const { fill, pill } = makeEls();
    const { rerender } = driver(fill, pill, FAIR_RUN, "start");
    act(() => flushFrame(0));
    act(() => flushFrame(100));
    const widthAtComplete = fill.style.width;

    act(() => rerender({ run: null, transition: "complete" }));
    expect(fill.style.opacity).toBe("0");
    expect(fill.style.transition).toContain("opacity");
    expect(fill.style.width).toBe(widthAtComplete); // preserved under the fade
  });

  it("snaps hidden immediately on cancellation (instant)", () => {
    const { fill, pill } = makeEls();
    const { rerender } = driver(fill, pill, FAIR_RUN, "start");
    act(() => flushFrame(0));
    act(() => flushFrame(100));

    act(() => rerender({ run: null, transition: "instant" }));
    expect(fill.style.opacity).toBe("0");
    expect(fill.style.width).toBe("0px");
    expect(fill.style.left).toBe("0px");
    expect(fill.style.transition).toBe("none");
  });

  it("snaps hidden when the run clears under any non-complete transition", () => {
    // Defensive: `run === null` with a stale `"start"` isn't reachable through the store today, but the
    // resolve effect must still hide the fill rather than leave it frozen mid-sweep at opacity 1.
    const { fill, pill } = makeEls();
    const { rerender } = driver(fill, pill, FAIR_RUN, "start");
    act(() => flushFrame(0));
    act(() => flushFrame(100));

    act(() => rerender({ run: null, transition: "start" }));
    expect(fill.style.opacity).toBe("0");
    expect(fill.style.width).toBe("0px");
    expect(fill.style.left).toBe("0px");
  });

  it("resets to the off-screen start on a new run", () => {
    const { fill, pill } = makeEls();
    const { rerender } = driver(fill, pill, FAIR_RUN, "start");
    advanceMs(500); // sweep partway
    expect(Number.parseFloat(fill.style.width)).toBeGreaterThan(H);

    // A new run (new runId) re-arms the reset layout effect before the next sweep.
    act(() => rerender({ run: { ...FAIR_RUN, runId: 2 }, transition: "start" }));
    expect(fill.style.width).toBe(`${H}px`);
    expect(fill.style.left).toBe(`${-H}px`);
    expect(fill.style.opacity).toBe("1");
  });
});
