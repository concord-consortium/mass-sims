import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFocusTrap } from "./use-focus-trap";

function Trap() {
  const rootRef = useRef<HTMLDivElement>(null);
  useFocusTrap(rootRef);
  return (
    <div ref={rootRef}>
      <button type="button">First</button>
      <button tabIndex={-1} type="button">
        Skipped
      </button>
      <button type="button">Last</button>
    </div>
  );
}

// jsdom does no layout, so every element reports no boxes; give them one so they count as showing.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    new DOMRect(0, 0, 10, 10),
  ] as unknown as DOMRectList);
});
afterEach(() => vi.restoreAllMocks());

describe("useFocusTrap", () => {
  it("wraps Tab from the last focusable to the first, and Shift+Tab back", () => {
    const view = render(<Trap />);
    const first = view.getByRole("button", { name: "First" });
    const last = view.getByRole("button", { name: "Last" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("leaves Tab alone between the ends", () => {
    const view = render(<Trap />);
    const first = view.getByRole("button", { name: "First" });
    first.focus();
    expect(fireEvent.keyDown(first, { key: "Tab" })).toBe(true);
    expect(document.activeElement).toBe(first);
  });
});
