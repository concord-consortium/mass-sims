import { act, render } from "@testing-library/react";
import { createElement, type RefObject, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWeatherAnimation } from "./use-weather-animation";
import { NO_SCENE, SCENES, type SceneSpec } from "./weather-scenes";

/**
 * Hook-lifecycle suite — the highest-risk surface. jsdom provides none of the browser APIs the hook composes
 * (a real 2D context, rAF, matchMedia, ResizeObserver), so this file mocks each explicitly and asserts the
 * behaviors the component/panel tests structurally can't reach: clear-on-stop, player switch, live
 * reduced-motion, visibility pause, the measurement triggers, the DPR transform, and the null-context no-op.
 */

// ─── A minimal but complete 2D-context mock (players call many draw methods) ─────────────────────────────
function makeCtx(): CanvasRenderingContext2D {
  const gradient = { addColorStop: vi.fn() } as unknown as CanvasGradient;
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

// ─── rAF ─────────────────────────────────────────────────────────────────────────────────────────────────
let rafCallbacks: Map<number, FrameRequestCallback>;
let rafSeq: number;
let cancelCount: number;

/** Number of scheduled-but-not-yet-run frames — `useFrameLoop` keeps exactly one in flight while enabled. */
function pending(): number {
  return rafCallbacks.size;
}

/** Run the latest pending frame (which reschedules itself, as `useFrameLoop`'s tick does). */
function flushFrame(ts = 16): void {
  const entries = [...rafCallbacks.entries()];
  if (entries.length === 0) return;
  const [id, cb] = entries[entries.length - 1];
  rafCallbacks.delete(id);
  cb(ts);
}

// ─── matchMedia (a single live object; `matches` is a getter so post-creation flips are seen) ─────────────
let mediaMatches: boolean;
let mediaListeners: Set<(e: { matches: boolean }) => void>;

const mql = {
  get matches() {
    return mediaMatches;
  },
  media: "(prefers-reduced-motion: reduce)",
  onchange: null,
  addEventListener: (_type: string, cb: (e: { matches: boolean }) => void) =>
    mediaListeners.add(cb),
  removeEventListener: (_type: string, cb: (e: { matches: boolean }) => void) =>
    mediaListeners.delete(cb),
  addListener: (cb: (e: { matches: boolean }) => void) => mediaListeners.add(cb),
  removeListener: (cb: (e: { matches: boolean }) => void) => mediaListeners.delete(cb),
  dispatchEvent: () => true,
} as unknown as MediaQueryList;

function setMatchMedia(fn: typeof window.matchMedia | undefined): void {
  window.matchMedia = fn as typeof window.matchMedia;
}

function fireReducedMotion(matches: boolean): void {
  mediaMatches = matches;
  act(() => {
    for (const cb of mediaListeners) cb({ matches });
  });
}

// ─── ResizeObserver ──────────────────────────────────────────────────────────────────────────────────────
let roInstances: MockResizeObserver[];
class MockResizeObserver {
  cb: ResizeObserverCallback;
  observed: Element[] = [];
  disconnected = false;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
    roInstances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
}

let mockCtx: CanvasRenderingContext2D;
let hiddenValue: boolean;

beforeEach(() => {
  rafCallbacks = new Map();
  rafSeq = 0;
  cancelCount = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = ++rafSeq;
    rafCallbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    cancelCount++;
    rafCallbacks.delete(id);
  });

  mediaMatches = false;
  mediaListeners = new Set();
  setMatchMedia(vi.fn(() => mql));

  roInstances = [];
  vi.stubGlobal("ResizeObserver", MockResizeObserver);

  mockCtx = makeCtx();
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => mockCtx,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });
  hiddenValue = false;
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hiddenValue });
});

afterEach(() => {
  vi.unstubAllGlobals();
  // Restore the shared test-setup default (a null 2D context) for other suites.
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

// Mirror the production tree: the panel owns `panelRef`, and a child component (like `WeatherScene`) calls the
// hook and renders the canvas. The nesting matters — the child's mount commit runs before the parent's ref is
// attached, so on mount `panelRef.current` is null inside a layout effect. A flatter harness would hide that.
function SceneChild({
  scene,
  panelRef,
}: {
  scene: SceneSpec;
  panelRef: RefObject<HTMLDivElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWeatherAnimation(canvasRef, panelRef, scene);
  return createElement("canvas", { ref: canvasRef, "data-testid": "canvas" });
}
function Harness({ scene }: { scene: SceneSpec }) {
  const panelRef = useRef<HTMLDivElement>(null);
  return createElement(
    "div",
    { className: "noreaster-data-panel", ref: panelRef, "data-testid": "panel" },
    createElement(SceneChild, { scene, panelRef }),
    createElement("div", { className: "wo-row" }),
    createElement("div", { className: "wo-row", "data-testid": "row2" }),
  );
}

const renderHarness = (scene: SceneSpec) => render(createElement(Harness, { scene }));

describe("useWeatherAnimation — scheduling & clear-on-stop", () => {
  it("schedules one frame for an active scene, then clears the canvas AND cancels the rAF on stop", () => {
    const { rerender } = renderHarness(SCENES.strong);
    expect(pending()).toBe(1);
    flushFrame();
    expect(vi.mocked(mockCtx.clearRect)).toHaveBeenCalled();

    vi.mocked(mockCtx.clearRect).mockClear();
    rerender(createElement(Harness, { scene: NO_SCENE })); // outcome → null

    expect(pending()).toBe(0); // rAF cancelled…
    expect(cancelCount).toBeGreaterThan(0);
    expect(vi.mocked(mockCtx.clearRect)).toHaveBeenCalled(); // …and the leftover frame cleared, not just cancelled
  });

  it("switches players without leaking a rAF: snow → haze keeps exactly one loop", () => {
    const { rerender } = renderHarness(SCENES.strong);
    expect(pending()).toBe(1);
    flushFrame();
    rerender(createElement(Harness, { scene: SCENES.humidNoStorm })); // snow → haze; enabled stays true
    // One continuous loop (composing `useFrameLoop` means an enabled→enabled player swap doesn't restart it).
    expect(pending()).toBe(1);
    flushFrame();
    expect(pending()).toBe(1);
  });
});

describe("useWeatherAnimation — reactive reduced-motion", () => {
  it("stops + clears when reduce turns on, restarts when it turns off, and unsubscribes on unmount", () => {
    const { unmount } = renderHarness(SCENES.strong);
    expect(pending()).toBe(1);

    vi.mocked(mockCtx.clearRect).mockClear();
    fireReducedMotion(true);
    expect(pending()).toBe(0); // particles stopped…
    expect(vi.mocked(mockCtx.clearRect)).toHaveBeenCalled(); // …and cleared

    fireReducedMotion(false);
    expect(pending()).toBe(1); // restarted

    expect(mediaListeners.size).toBeGreaterThan(0);
    unmount();
    expect(mediaListeners.size).toBe(0); // change listener removed
  });
});

describe("useWeatherAnimation — visibility pause", () => {
  it("pauses the loop when the tab is hidden and resumes when visible", () => {
    renderHarness(SCENES.strong);
    expect(pending()).toBe(1);

    act(() => {
      hiddenValue = true;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(pending()).toBe(0);

    act(() => {
      hiddenValue = false;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    // Resumes — `useFrameLoop` re-inits its frame clock on re-enable, so the first post-resume delta is 0.
    expect(pending()).toBe(1);
  });
});

describe("useWeatherAnimation — measurement", () => {
  it("measures on mount and writes --wo-scene-height (fallback when jsdom has no layout)", () => {
    const { getByTestId } = renderHarness(NO_SCENE);
    expect(getByTestId("panel").style.getPropertyValue("--wo-scene-height")).toBe("120px");
  });

  it("re-measures on a scene change via the layout effect even with no ResizeObserver callback", () => {
    const { getByTestId, rerender } = renderHarness(SCENES.strong);
    const panel = getByTestId("panel");
    // Give the 2nd `.wo-row` a real top so the next measure computes a concrete header height.
    panel.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    getByTestId("row2").getBoundingClientRect = () => ({ top: 60 }) as DOMRect;
    rerender(createElement(Harness, { scene: SCENES.fair })); // scene change → layout-effect re-measure
    expect(panel.style.getPropertyValue("--wo-scene-height")).toBe("60px");
  });

  it("observes the PANEL (not the scene) and disconnects the ResizeObserver on unmount", () => {
    const { getByTestId, unmount } = renderHarness(SCENES.strong);
    expect(roInstances).toHaveLength(1);
    expect(roInstances[0].observed).toContain(getByTestId("panel"));
    unmount();
    expect(roInstances[0].disconnected).toBe(true);
  });

  it("does NOT re-allocate the backing store or reset the transform on a no-op resize (anti-flicker)", () => {
    const { getByTestId } = renderHarness(SCENES.strong);
    const canvas = getByTestId("canvas") as HTMLCanvasElement;
    // Mount sized the canvas once (from the 300×150 default) and applied the transform once.
    const widthAfterMount = canvas.width;
    expect(vi.mocked(mockCtx.setTransform)).toHaveBeenCalledTimes(1);

    // A ResizeObserver tick with unchanged layout (jsdom → same fallback height) must be a no-op: writing
    // `canvas.width` even to the same value would wipe the just-drawn frame.
    act(() => roInstances[0].cb([], roInstances[0]));
    expect(canvas.width).toBe(widthAfterMount);
    expect(vi.mocked(mockCtx.setTransform)).toHaveBeenCalledTimes(1); // not re-applied
  });
});

describe("useWeatherAnimation — fixed artboard & DPR", () => {
  it("backs the canvas at 400 × clamped-DPR and applies the DPR transform", () => {
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 3 });
    const { getByTestId } = renderHarness(SCENES.strong);
    const canvas = getByTestId("canvas") as HTMLCanvasElement;
    expect(canvas.width).toBe(800); // 400 × min(3, 2), NOT cssW × dpr
    expect(vi.mocked(mockCtx.setTransform)).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
  });
});

describe("useWeatherAnimation — guards", () => {
  it("takes the no-op path with a null 2D context: never schedules a frame", () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    renderHarness(SCENES.strong);
    expect(pending()).toBe(0);
    expect(rafSeq).toBe(0); // requestAnimationFrame was never called — no context to draw on
  });

  it("does not throw when matchMedia is absent (jsdom guard)", () => {
    setMatchMedia(undefined);
    expect(() => renderHarness(SCENES.strong)).not.toThrow();
  });
});
