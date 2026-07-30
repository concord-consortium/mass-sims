import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useDocumentHidden } from "./use-document-hidden";

/** Set `document.hidden` and fire the `visibilitychange` event. */
function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useDocumentHidden", () => {
  afterEach(() => {
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
  });

  it("tracks document.hidden across visibilitychange", () => {
    const { result } = renderHook(() => useDocumentHidden());
    expect(result.current).toBe(false);
    act(() => setHidden(true));
    expect(result.current).toBe(true);
    act(() => setHidden(false));
    expect(result.current).toBe(false);
  });
});
