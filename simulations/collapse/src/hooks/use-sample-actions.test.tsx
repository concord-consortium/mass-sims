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
import { useSampleActions } from "./use-sample-actions";

function setup(rng: () => number = () => 0.5) {
  const store = createRootStore({ rng });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RootStoreProvider store={store}>{children}</RootStoreProvider>
  );
  const { result } = renderHook(() => useSampleActions(), { wrapper });
  return { store, result };
}

/** Takes a sample in the store directly, without logging or announcing. */
function seed(store: ReturnType<typeof createRootStore>, years: number) {
  store.ui.setTimelineIndex(TIMELINE_VALUES.indexOf(years));
  return store.takeSample();
}

beforeEach(() => {
  logEvent.mockClear();
  announce.mockClear();
});

describe("useSampleActions.takeSample", () => {
  it("adds a row to the selected trial, logs once, and announces", () => {
    const { store, result } = setup(() => 0.5);
    store.ui.selectTrial("B");
    act(() => result.current.takeSample());
    expect(store.trials.get("B")?.sampleCount).toBe(1);
    expect(store.selectedSample?.years).toBe(200000);
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith("sample_taken", {
      trial: "B",
      years: 200000,
      rate: 30,
      roof: 8800,
      collapsed: false,
      sampleCount: 1,
    });
    expect(announce).toHaveBeenCalledWith(
      "Sampled 200,000 years before collapse. Erosion rate 30 millimeters per 1,000 years, " +
        "rock above the cave 8,800 millimeters. Trial B now has 1 sample.",
    );
  });

  it("logs the rate unrounded, flags a collapse, and counts in the plural", () => {
    const { store, result } = setup(() => 1);
    store.ui.selectTrial("B");
    store.ui.setTimelineIndex(TIMELINE_VALUES.indexOf(0));
    act(() => result.current.takeSample());
    act(() => result.current.takeSample());
    const payload = logEvent.mock.calls[1][1];
    expect(payload.rate).toBeCloseTo(34.5, 10);
    expect(payload.roof).toBe(2800);
    expect(payload.collapsed).toBe(true);
    expect(payload.sampleCount).toBe(2);
    expect(announce).toHaveBeenLastCalledWith(
      "Sampled 0 years before collapse. Erosion rate 35 millimeters per 1,000 years, " +
        "rock above the cave 2,800 millimeters. Trial B now has 2 samples.",
    );
  });
});

describe("useSampleActions.selectSample", () => {
  it("selects a row, logs once, and announces", () => {
    const { store, result } = setup();
    const first = seed(store, 150000);
    seed(store, 0);
    act(() => result.current.selectSample(first.id));
    expect(store.selectedSample).toEqual(first);
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith("sample_selected", {
      trial: "A",
      years: 150000,
      selected: true,
    });
    expect(announce).toHaveBeenCalledWith("Selected the sample at 150,000 years before collapse.");
  });

  it("selecting the selected row deselects it", () => {
    const { store, result } = setup();
    const sample = seed(store, 50000);
    act(() => result.current.selectSample(sample.id));
    expect(store.selectedSample).toBeUndefined();
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith("sample_selected", {
      trial: "A",
      years: 50000,
      selected: false,
    });
    expect(announce).toHaveBeenCalledWith("Deselected. Select a row to see its cross section.");
  });

  it("null deselects, and does nothing when nothing is selected", () => {
    const { store, result } = setup();
    seed(store, 50000);
    act(() => result.current.selectSample(null));
    expect(store.selectedSample).toBeUndefined();
    expect(logEvent).toHaveBeenCalledTimes(1);
    act(() => result.current.selectSample(null));
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it("does nothing for an unknown id", () => {
    const { store, result } = setup();
    const sample = seed(store, 50000);
    act(() => result.current.selectSample(99));
    expect(store.selectedSample).toEqual(sample);
    expect(logEvent).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  });
});

describe("useSampleActions.deleteSample", () => {
  it("deletes by id, logs once, and announces the count left", () => {
    const { store, result } = setup();
    const first = seed(store, 200000);
    const second = seed(store, 100000);
    const third = seed(store, 0);
    act(() => result.current.deleteSample(second.id));
    expect(store.activeTrial.samples).toEqual([first, third]);
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith("sample_deleted", {
      trial: "A",
      years: 100000,
      remaining: 2,
    });
    expect(announce).toHaveBeenCalledWith("Row deleted. 2 samples left.");
    act(() => result.current.deleteSample(first.id));
    expect(announce).toHaveBeenLastCalledWith("Row deleted. 1 sample left.");
  });

  it("clears the selection when the selected row is deleted", () => {
    const { store, result } = setup();
    const sample = seed(store, 0);
    act(() => result.current.deleteSample(sample.id));
    expect(store.selectedSample).toBeUndefined();
    expect(announce).toHaveBeenCalledWith("Row deleted. 0 samples left.");
  });

  it("does nothing for an unknown id", () => {
    const { store, result } = setup();
    seed(store, 0);
    act(() => result.current.deleteSample(99));
    expect(store.activeTrial.sampleCount).toBe(1);
    expect(logEvent).not.toHaveBeenCalled();
  });
});

describe("useSampleActions.cycleSort", () => {
  it("cycles the sort, logs each press once, and announces the state", () => {
    const { store, result } = setup();
    store.ui.selectTrial("C");
    act(() => result.current.cycleSort("rate"));
    expect(store.ui.sort).toEqual({ key: "rate", direction: 1 });
    expect(logEvent).toHaveBeenLastCalledWith("table_sorted", {
      trial: "C",
      key: "rate",
      direction: "ascending",
    });
    expect(announce).toHaveBeenLastCalledWith("Sorted by Erosion rate, lowest first.");

    act(() => result.current.cycleSort("rate"));
    expect(logEvent).toHaveBeenLastCalledWith("table_sorted", {
      trial: "C",
      key: "rate",
      direction: "descending",
    });
    expect(announce).toHaveBeenLastCalledWith("Sorted by Erosion rate, highest first.");

    act(() => result.current.cycleSort("rate"));
    expect(store.ui.sort.key).toBeNull();
    expect(logEvent).toHaveBeenLastCalledWith("table_sorted", {
      trial: "C",
      key: "rate",
      direction: "none",
    });
    expect(announce).toHaveBeenLastCalledWith(
      "Not sorted. Back to the order you took the samples in.",
    );
    expect(logEvent).toHaveBeenCalledTimes(3);
  });

  it("names each column without its unit", () => {
    const { result } = setup();
    act(() => result.current.cycleSort("years"));
    expect(announce).toHaveBeenLastCalledWith("Sorted by Years before collapse, lowest first.");
    act(() => result.current.cycleSort("roof"));
    expect(announce).toHaveBeenLastCalledWith("Sorted by Rock above cave, lowest first.");
  });
});
