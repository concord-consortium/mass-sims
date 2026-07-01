import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useScrollFocusRing } from "./use-scroll-focus-ring";

function Region() {
  const ref = useScrollFocusRing<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="region">
      content
    </div>
  );
}

// Reproduces the modal case: the scroll node appears only after the first render.
function DeferredRegion() {
  const ref = useScrollFocusRing<HTMLDivElement>();
  const [shown, setShown] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setShown(true)}>
        show
      </button>
      {shown ? (
        <div ref={ref} data-testid="region">
          content
        </div>
      ) : null}
    </>
  );
}

// jsdom reports 0 for scrollHeight/clientHeight (no layout). Drive overflow by mocking the
// prototype getters so the hook's mount-time evaluation sees the values we want.
function mockOverflow(scrollHeight: number, clientHeight: number) {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get: () => scrollHeight,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => clientHeight,
  });
}

afterEach(() => {
  // Remove the prototype overrides so other suites see real jsdom behavior.
  delete (HTMLElement.prototype as unknown as { scrollHeight?: number }).scrollHeight;
  delete (HTMLElement.prototype as unknown as { clientHeight?: number }).clientHeight;
});

describe("useScrollFocusRing", () => {
  it("makes the region focusable (tabindex 0) when it overflows", () => {
    mockOverflow(500, 100);
    const { getByTestId } = render(<Region />);
    expect(getByTestId("region")).toHaveAttribute("tabindex", "0");
  });

  it("leaves the region unfocusable (no tabindex) when it does not overflow", () => {
    mockOverflow(100, 100);
    const { getByTestId } = render(<Region />);
    expect(getByTestId("region")).not.toHaveAttribute("tabindex");
  });

  it("attaches to a scroller that mounts after the first render (the modal case)", async () => {
    mockOverflow(500, 100);
    const { getByRole, findByTestId } = render(<DeferredRegion />);
    fireEvent.click(getByRole("button", { name: "show" }));
    expect(await findByTestId("region")).toHaveAttribute("tabindex", "0");
  });
});
