import { render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useDialogLifecycle } from "./use-dialog-lifecycle";

function Dialog() {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogLifecycle(rootRef, { initialFocus: closeRef, opener: ".opener" });
  return (
    <div ref={rootRef}>
      <button ref={closeRef} type="button">
        Close
      </button>
    </div>
  );
}

/** A frame with a title bar, a pre-inert aside, and a `main` holding a panel and the dialog. */
function Frame({ open }: { open: boolean }) {
  return (
    <div className="frame">
      <header>title</header>
      <aside inert>already inert</aside>
      <main>
        <section>
          <button className="opener" type="button">
            Open
          </button>
        </section>
        {open && <Dialog />}
      </main>
    </div>
  );
}

describe("useDialogLifecycle", () => {
  it("removes inert before it focuses the opener, so the focus is not lost", () => {
    const view = render(<Frame open />);
    const opener = view.getByRole("button", { name: "Open" });
    const section = view.container.querySelector("section");
    expect(section).toHaveAttribute("inert");
    let inertWhenFocused: boolean | undefined;
    vi.spyOn(opener, "focus").mockImplementation(() => {
      inertWhenFocused = section?.hasAttribute("inert");
    });
    view.rerender(<Frame open={false} />);
    expect(opener.focus).toHaveBeenCalledTimes(1);
    expect(inertWhenFocused).toBe(false);
  });

  it("leaves an element that was already inert inert on close", () => {
    const view = render(<Frame open />);
    expect(view.container.querySelector("header")).toHaveAttribute("inert");
    view.rerender(<Frame open={false} />);
    expect(view.container.querySelector("header")).not.toHaveAttribute("inert");
    expect(view.container.querySelector("aside")).toHaveAttribute("inert");
  });
});
