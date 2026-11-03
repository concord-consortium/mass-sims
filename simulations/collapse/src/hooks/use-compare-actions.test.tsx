import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock only `useLogEvent` and `useAnnounce`, keeping the real shared exports. `vi.hoisted` so the
// spies exist when `vi.mock` runs.
const { logEvent, announce } = vi.hoisted(() => ({ logEvent: vi.fn(), announce: vi.fn() }));
vi.mock("@concord-consortium/mass-sims-shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@concord-consortium/mass-sims-shared")>()),
  useLogEvent: () => logEvent,
  useAnnounce: () => announce,
}));

import { TIMELINE_VALUES } from "../model/timeline";
import { createRootStore, RootStoreProvider } from "../stores/root-store";
import { useCompareActions } from "./use-compare-actions";

function setup() {
  const store = createRootStore({ rng: () => 0.5 });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RootStoreProvider store={store}>{children}</RootStoreProvider>
  );
  const { result } = renderHook(() => useCompareActions(), { wrapper });
  return { store, result };
}

/** Takes a sample in `letter` at `years` in the store directly, without logging or announcing. */
function seed(store: ReturnType<typeof createRootStore>, letter: string, years: number) {
  store.ui.selectTrial(letter);
  store.ui.setTimelineIndex(TIMELINE_VALUES.indexOf(years));
  return store.takeSample();
}

beforeEach(() => {
  logEvent.mockClear();
  announce.mockClear();
});

describe("useCompareActions.openCompare", () => {
  it("opens with the selected row's year pinned, logs once, and announces", () => {
    const { store, result } = setup();
    seed(store, "B", 50000);
    act(() => result.current.openCompare());
    expect(store.ui.compareOpen).toBe(true);
    expect(store.ui.pinnedYear).toBe(50000);
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith("compare_opened", { trial: "B", pinnedYears: 50000 });
    expect(announce).toHaveBeenCalledWith("Comparing all four trials.");
  });

  it("logs a null pin when nothing is selected", () => {
    const { result } = setup();
    act(() => result.current.openCompare());
    expect(logEvent).toHaveBeenCalledWith("compare_opened", { trial: "A", pinnedYears: null });
  });

  it("does nothing when already open", () => {
    const { result } = setup();
    act(() => result.current.openCompare());
    act(() => result.current.openCompare());
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it("pins again from the selection on the next open, after a close", () => {
    const { store, result } = setup();
    act(() => result.current.openCompare());
    act(() => store.ui.togglePin(0));
    act(() => result.current.closeCompare("close"));
    expect(store.ui.pinnedYear).toBe(0);
    act(() => result.current.openCompare());
    expect(store.ui.pinnedYear).toBeNull();
  });
});

describe("useCompareActions.closeCompare", () => {
  it("closes, logs the source once, and announces", () => {
    const { store, result } = setup();
    act(() => result.current.openCompare());
    logEvent.mockClear();
    act(() => result.current.closeCompare("escape"));
    expect(store.ui.compareOpen).toBe(false);
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith("compare_closed", { trial: "A", source: "escape" });
    expect(announce).toHaveBeenLastCalledWith("Comparison closed.");
  });

  it("does nothing when already closed", () => {
    const { result } = setup();
    act(() => result.current.closeCompare("close"));
    expect(logEvent).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  });
});

describe("useCompareActions.togglePin", () => {
  it("pins a year, logs once, and announces which trials have it", () => {
    const { store, result } = setup();
    seed(store, "A", 50000);
    seed(store, "C", 50000);
    act(() => result.current.togglePin(50000));
    expect(store.ui.pinnedYear).toBe(50000);
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith("compare_year_pinned", {
      trial: "C",
      years: 50000,
      pinned: true,
      trials: ["A", "C"],
    });
    expect(announce).toHaveBeenCalledWith(
      "50,000 years before collapse pinned. Sampled in trials A, C; not in B, D.",
    );
  });

  it("names one trial in the singular, and says all four when every trial has the year", () => {
    const { store, result } = setup();
    seed(store, "B", 0);
    act(() => result.current.togglePin(0));
    expect(announce).toHaveBeenLastCalledWith(
      "0 years before collapse pinned. Sampled in trial B; not in A, C, D.",
    );
    for (const letter of ["A", "C", "D"]) seed(store, letter, 0);
    act(() => result.current.togglePin(100000));
    act(() => result.current.togglePin(0));
    expect(announce).toHaveBeenLastCalledWith(
      "0 years before collapse pinned. Sampled in all four trials.",
    );
  });

  it("pinning the pinned year clears it, logs pinned false, and announces", () => {
    const { store, result } = setup();
    seed(store, "A", 50000);
    act(() => result.current.togglePin(50000));
    act(() => result.current.togglePin(50000));
    expect(store.ui.pinnedYear).toBeNull();
    expect(logEvent).toHaveBeenCalledTimes(2);
    expect(logEvent).toHaveBeenLastCalledWith("compare_year_pinned", {
      trial: "A",
      years: 50000,
      pinned: false,
      trials: ["A"],
    });
    expect(announce).toHaveBeenLastCalledWith("Pin cleared.");
  });
});
