import { act, render } from "@testing-library/react";
import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The runner logs `simulation_run` through lara-interactive-api's `log` at finalize; mock the transport
// so we can assert it (and it doesn't reach the real API in jsdom).
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({ log }));

import { createRootStore, type RootStoreInstance, RootStoreProvider } from "../stores/root-store";
import { configureStrong, STRONG_SETUP } from "../stores/test-helpers";
import { useStormRun } from "./use-storm-run";

// ─── rAF mock: `useFrameLoop` keeps one frame pending at a time; flushFrame runs the latest with a
// timestamp (the tick reschedules itself, exactly as `useFrameLoop` does). ────────────────────────────
let rafCallbacks: Map<number, FrameRequestCallback>;
let rafSeq: number;

function flushFrame(ts: number): void {
  const entries = [...rafCallbacks.entries()];
  if (entries.length === 0) return;
  const [id, cb] = entries[entries.length - 1];
  rafCallbacks.delete(id);
  cb(ts);
}

/** Feed the clock `totalMs` of elapsed time in 100 ms frames (the runner clamps per-frame dt at 100 ms). */
function advanceMs(totalMs: number): void {
  act(() => flushFrame(0)); // first frame establishes the clock (delta 0)
  let ts = 0;
  const steps = Math.ceil(totalMs / 100) + 1;
  for (let i = 0; i < steps; i++) {
    ts += 100;
    act(() => flushFrame(ts));
  }
}

// prefers-reduced-motion state, read by the runner's initial snapshot.
let mediaMatches: boolean;

beforeEach(() => {
  log.mockClear();
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
  mediaMatches = false;
  window.matchMedia = vi.fn(() => ({
    get matches() {
      return mediaMatches;
    },
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// The runner reads `ui.run` reactively, so its host must be an `observer` (as the map stage is). It
// renders nothing. `useAnnounce` no-ops without an `<Announcer>` provider.
const Harness = observer(function Harness() {
  useStormRun();
  return null;
});

function renderRunner(store: RootStoreInstance) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RootStoreProvider store={store}>{children}</RootStoreProvider>
  );
  return render(<Harness />, { wrapper });
}

describe("useStormRun — deferred run clock", () => {
  it("finalizes at totalDur: commits the captured outcome and logs simulation_run", () => {
    const store = createRootStore();
    configureStrong(store.activeTrial);
    renderRunner(store);
    act(() => {
      store.beginRun(); // strong → totalDur 11.5 s
    });
    expect(store.activeTrial.outcome).toBeNull(); // deferred while the clock runs

    advanceMs(11500);

    expect(store.activeTrial.outcome).toBe("strong");
    expect(store.ui.run).toBeNull();
    expect(log).toHaveBeenCalledWith("simulation_run", {
      trial: "A",
      replay: false,
      outcome: "strong",
      ...STRONG_SETUP,
    });
  });

  it("does not finalize before totalDur elapses", () => {
    const store = createRootStore();
    configureStrong(store.activeTrial);
    renderRunner(store);
    act(() => {
      store.beginRun();
    });
    advanceMs(3000); // well short of strong's 11.5 s

    expect(store.activeTrial.outcome).toBeNull();
    expect(store.ui.isRunning("A")).toBe(true);
    expect(log).not.toHaveBeenCalledWith("simulation_run", expect.anything());
  });

  it("cancel mid-run stops the clock — no finalize even as frames keep coming", () => {
    const store = createRootStore();
    configureStrong(store.activeTrial);
    renderRunner(store);
    let id: number | null = null;
    act(() => {
      id = store.beginRun();
    });
    advanceMs(3000);
    act(() => {
      store.cancelRun(id as number);
    });
    advanceMs(20000);

    expect(store.activeTrial.outcome).toBeNull();
    expect(store.ui.run).toBeNull();
    expect(log).not.toHaveBeenCalledWith("simulation_run", expect.anything());
  });

  it("under reduced motion, finalizes immediately without the clock", () => {
    mediaMatches = true; // prefers-reduced-motion: reduce
    const store = createRootStore();
    configureStrong(store.activeTrial);
    renderRunner(store);
    act(() => {
      store.beginRun();
    });
    // No frames advanced — the reduced-motion path finalizes on the effect flush.
    expect(store.activeTrial.outcome).toBe("strong");
    expect(store.ui.run).toBeNull();
    expect(log).toHaveBeenCalledWith("simulation_run", {
      trial: "A",
      replay: false,
      outcome: "strong",
      ...STRONG_SETUP,
    });
  });
});
