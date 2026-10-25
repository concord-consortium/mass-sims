import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock only `useLogEvent`, keeping the real shared exports. `vi.hoisted` so the spy exists when
// `vi.mock` runs.
const { logEvent } = vi.hoisted(() => ({ logEvent: vi.fn() }));
vi.mock("@concord-consortium/mass-sims-shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@concord-consortium/mass-sims-shared")>()),
  useLogEvent: () => logEvent,
}));

import { TIMELINE_VALUES } from "../model/timeline";
import { createRootStore, RootStoreProvider } from "../stores/root-store";
import { useSetSampleYears } from "./use-set-sample-years";

const LAST = TIMELINE_VALUES.length - 1;

function setup() {
  const store = createRootStore();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RootStoreProvider store={store}>{children}</RootStoreProvider>
  );
  const { result } = renderHook(() => useSetSampleYears(), { wrapper });
  return { store, result };
}

beforeEach(() => {
  logEvent.mockClear();
});

describe("useSetSampleYears", () => {
  it("set writes the store and logs the change once", () => {
    const { store, result } = setup();
    store.ui.selectTrial("C");
    act(() => result.current.set(3, "slider"));
    expect(store.ui.timelineIndex).toBe(3);
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith("sample_years_set", {
      value: 50000,
      previous: 200000,
      trial: "C",
      source: "slider",
    });
  });

  it("step moves one value and logs its source", () => {
    const { store, result } = setup();
    act(() => result.current.step(1, "stepper"));
    expect(store.ui.timelineIndex).toBe(1);
    act(() => result.current.step(-1, "stepper"));
    expect(store.ui.timelineIndex).toBe(0);
    expect(logEvent).toHaveBeenCalledTimes(2);
    expect(logEvent).toHaveBeenLastCalledWith("sample_years_set", {
      value: 200000,
      previous: 150000,
      trial: "A",
      source: "stepper",
    });
  });

  it("does not log when the value does not change", () => {
    const { store, result } = setup();
    act(() => result.current.set(0, "slider"));
    expect(logEvent).not.toHaveBeenCalled();
    act(() => result.current.set(7, "slider"));
    logEvent.mockClear();
    act(() => result.current.set(7, "slider"));
    expect(store.ui.timelineIndex).toBe(7);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("setWithoutLog writes the store, and logChange logs once from the given value", () => {
    const { store, result } = setup();
    act(() => result.current.setWithoutLog(2));
    act(() => result.current.setWithoutLog(4));
    expect(store.ui.timelineIndex).toBe(4);
    expect(logEvent).not.toHaveBeenCalled();
    act(() => result.current.logChange(200000, "slider"));
    expect(logEvent).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith("sample_years_set", {
      value: 20000,
      previous: 200000,
      trial: "A",
      source: "slider",
    });
    act(() => result.current.logChange(20000, "slider"));
    expect(logEvent).toHaveBeenCalledTimes(1);
  });

  it("step at either end is a no-op", () => {
    const { store, result } = setup();
    act(() => result.current.step(-1, "stepper"));
    expect(store.ui.timelineIndex).toBe(0);
    act(() => result.current.set(LAST, "slider"));
    logEvent.mockClear();
    act(() => result.current.step(1, "stepper"));
    expect(store.ui.timelineIndex).toBe(LAST);
    expect(logEvent).not.toHaveBeenCalled();
  });
});
