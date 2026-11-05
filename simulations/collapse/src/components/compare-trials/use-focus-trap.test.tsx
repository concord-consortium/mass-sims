import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFocusTrap } from "./use-focus-trap";

/**
 * A frame: a title-bar button, then `main` with the dialog and an inert panel after it, then an
 * About panel when `about` is set.
 */
function Frame({ about = false }: { about?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useFocusTrap(rootRef);
  return (
    <div>
      <button type="button">About</button>
      <main>
        <div ref={rootRef} tabIndex={-1}>
          <button type="button">First</button>
          <button tabIndex={-1} type="button">
            Skipped
          </button>
          <button type="button">Last</button>
          <button tabIndex={-1} type="button">
            After
          </button>
        </div>
        <section inert>
          <button type="button">Inert</button>
        </section>
      </main>
      {about && (
        <aside>
          <button type="button">Close About</button>
          <a href="#more">More</a>
        </aside>
      )}
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
  it("wraps Tab from the dialog's last stop to the About button, skipping what is inert", () => {
    const view = render(<Frame />);
    const about = view.getByRole("button", { name: "About" });
    const last = view.getByRole("button", { name: "Last" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(about);
    fireEvent.keyDown(about, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("wraps from an element past the last stop that only the arrow keys reach", () => {
    const view = render(<Frame />);
    const after = view.getByRole("button", { name: "After" });
    after.focus();
    fireEvent.keyDown(after, { key: "Tab" });
    expect(document.activeElement).toBe(view.getByRole("button", { name: "About" }));
  });

  it("leaves Tab alone between the ends", () => {
    const view = render(<Frame />);
    const first = view.getByRole("button", { name: "First" });
    first.focus();
    expect(fireEvent.keyDown(first, { key: "Tab" })).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it("with About open, takes in the About panel, links included", () => {
    const view = render(<Frame about />);
    const about = view.getByRole("button", { name: "About" });
    const last = view.getByRole("button", { name: "Last" });
    const link = view.getByRole("link", { name: "More" });
    const closeAbout = view.getByRole("button", { name: "Close About" });
    last.focus();
    expect(fireEvent.keyDown(last, { key: "Tab" })).toBe(true);
    closeAbout.focus();
    expect(fireEvent.keyDown(closeAbout, { key: "Tab" })).toBe(true);
    link.focus();
    fireEvent.keyDown(link, { key: "Tab" });
    expect(document.activeElement).toBe(about);
    fireEvent.keyDown(about, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(link);
  });
});
