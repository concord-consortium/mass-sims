import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReloadWarning } from "./use-reload-warning";

describe("useReloadWarning", () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addSpy = vi.spyOn(window, "addEventListener");
    removeSpy = vi.spyOn(window, "removeEventListener");
  });
  afterEach(() => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("registers a beforeunload listener when enabled", () => {
    renderHook(() => useReloadWarning(true));
    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("does not register a listener when disabled", () => {
    renderHook(() => useReloadWarning(false));
    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("removes the listener when toggled off", () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useReloadWarning(enabled),
      { initialProps: { enabled: true } },
    );

    rerender({ enabled: false });
    expect(removeSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("removes the listener on unmount", () => {
    const { unmount } = renderHook(() => useReloadWarning(true));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("the registered handler calls preventDefault and sets returnValue", () => {
    let registeredHandler: ((e: BeforeUnloadEvent) => void) | undefined;
    addSpy.mockImplementation(((type: string, handler: EventListener) => {
      if (type === "beforeunload") {
        registeredHandler = handler as (e: BeforeUnloadEvent) => void;
      }
    }) as typeof window.addEventListener);

    renderHook(() => useReloadWarning(true));

    expect(registeredHandler).toBeDefined();

    // jsdom's `Event.returnValue` implements the legacy DOM semantics (the getter returns
    // `!cancelled` as a boolean, not the value we assigned). Replace the property with a
    // plain getter/setter so we can observe the handler's assignment directly.
    let returnValueAssigned: unknown;
    const event = new Event("beforeunload", { cancelable: true });
    Object.defineProperty(event, "returnValue", {
      configurable: true,
      get: () => returnValueAssigned,
      set: (v) => {
        returnValueAssigned = v;
      },
    });
    const preventSpy = vi.spyOn(event, "preventDefault");

    registeredHandler?.(event as BeforeUnloadEvent);

    expect(preventSpy).toHaveBeenCalled();
    expect(returnValueAssigned).toBe("");
  });
});
