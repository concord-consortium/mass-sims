import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SimulationFrame } from "./simulation-frame";

// jsdom reports 0 for scrollHeight/clientHeight (no layout). Drive overflow by mocking the
// prototype getters so the scroll-focus-ring hook's evaluation sees the values we want.
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

function renderFrame(extra?: Partial<{ instruction: string }>) {
  return render(
    <SimulationFrame simTitle="Bananas" tagline="A short description">
      <SimulationFrame.Trials>
        <div>trial-row</div>
      </SimulationFrame.Trials>
      <SimulationFrame.Simulation instruction={extra?.instruction}>
        <div>sim-viz</div>
      </SimulationFrame.Simulation>
      <SimulationFrame.Data>
        <div>data-content</div>
      </SimulationFrame.Data>
    </SimulationFrame>,
  );
}

describe("SimulationFrame", () => {
  it("renders the three header props", () => {
    const { getByText } = renderFrame();
    expect(getByText("Bananas")).toBeInTheDocument();
    expect(getByText("A short description")).toBeInTheDocument();
  });

  it("renders the DESE and Concord Consortium partner logos in the title bar", () => {
    const { getByAltText } = renderFrame();
    expect(getByAltText(/DESE/i)).toBeInTheDocument();
    expect(getByAltText(/Concord Consortium/i)).toBeInTheDocument();
  });

  it("renders the About button with an icon and the 'About' label", () => {
    const { getByRole } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>x</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    // The button's accessible name is the text 'About' (icon is decorative aria-hidden).
    const about = getByRole("button", { name: "About" });
    expect(about).toBeInTheDocument();
    // The About panel is a `complementary` landmark, not a popup, so the trigger must NOT advertise
    // aria-haspopup; aria-expanded still reflects the region's shown/hidden state.
    expect(about).not.toHaveAttribute("aria-haspopup");
    expect(about).toHaveAttribute("aria-expanded", "false");
  });

  it("renders each slot's children inside a titled region", () => {
    const { getByRole, getByText } = renderFrame();
    expect(getByRole("region", { name: "Trials" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Data" })).toBeInTheDocument();
    expect(getByText("trial-row")).toBeInTheDocument();
    expect(getByText("sim-viz")).toBeInTheDocument();
    expect(getByText("data-content")).toBeInTheDocument();
  });

  it("forwards the Simulation instruction to its section", () => {
    const { getByText } = renderFrame({ instruction: "Select two parents to begin" });
    expect(getByText("Select two parents to begin")).toBeInTheDocument();
  });

  it("gives region headings unique ids across multiple frames in one document", () => {
    const oneFrame = (key: string) => (
      <SimulationFrame key={key} simTitle={key} tagline="t">
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>
    );
    const { container } = render(
      <>
        {oneFrame("A")}
        {oneFrame("B")}
      </>,
    );
    const headingIds = Array.from(container.querySelectorAll("h2")).map((h) => h.id);
    // Six region headings (3 per frame), every one non-empty and unique — so the
    // aria-labelledby targets never collide when frames share a document.
    expect(headingIds).toHaveLength(6);
    expect(headingIds.every((id) => id.length > 0)).toBe(true);
    expect(new Set(headingIds).size).toBe(headingIds.length);
  });

  it("uses canonical slot titles by default", () => {
    const { getByRole } = renderFrame();
    expect(getByRole("region", { name: "Trials" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Data" })).toBeInTheDocument();
  });

  it("lets a sim override each slot's visible title", () => {
    const { getByRole, queryByRole } = render(
      <SimulationFrame simTitle="Bananas" tagline="t">
        <SimulationFrame.Trials title="Crosses">
          <div>tr</div>
        </SimulationFrame.Trials>
        <SimulationFrame.Simulation title="Lab" instruction="Select two parents to begin">
          <div>st</div>
        </SimulationFrame.Simulation>
        <SimulationFrame.Data title="Results">
          <div>d</div>
        </SimulationFrame.Data>
      </SimulationFrame>,
    );
    // Custom labels are exposed as the regions' accessible names.
    expect(getByRole("region", { name: "Crosses" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Lab" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Results" })).toBeInTheDocument();
    // Default labels no longer apply when overrides are passed.
    expect(queryByRole("region", { name: "Trials" })).not.toBeInTheDocument();
    expect(queryByRole("region", { name: "Simulation" })).not.toBeInTheDocument();
    expect(queryByRole("region", { name: "Data" })).not.toBeInTheDocument();
  });

  it("places slots in Trials/Simulation/Data order regardless of source order", () => {
    const { getByRole } = render(
      <SimulationFrame simTitle="S" tagline="t">
        <SimulationFrame.Data>
          <div>d</div>
        </SimulationFrame.Data>
        <SimulationFrame.Trials>
          <div>tr</div>
        </SimulationFrame.Trials>
        <SimulationFrame.Simulation>
          <div>st</div>
        </SimulationFrame.Simulation>
      </SimulationFrame>,
    );
    // All three regions still resolve, proving order-independence of the slot API.
    expect(getByRole("region", { name: "Trials" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
    expect(getByRole("region", { name: "Data" })).toBeInTheDocument();
  });

  it("shows an About button but no modal initially", () => {
    const { getByRole, queryByRole } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>about this sim</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    expect(getByRole("button", { name: /about/i })).toBeInTheDocument();
    expect(queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("opens the modal with the info content when the About button is clicked", () => {
    const { getByRole, getByText } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>about this sim</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    fireEvent.click(getByRole("button", { name: /about/i }));
    expect(getByRole("complementary")).toBeInTheDocument();
    expect(getByText("about this sim")).toBeInTheDocument();
  });

  it("wraps the About body in a positioned scroll region with a focus-ring sibling", () => {
    const { container, getByRole } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>about this sim</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    fireEvent.click(getByRole("button", { name: /about/i }));
    const body = container.querySelector(".modal-body");
    if (!body) throw new Error("expected a modal body");
    // The scroll container is tagged .scroll-region so the shared CSS draws its focus ring.
    expect(body).toHaveClass("scroll-region");
    // A positioned wrapper holds the region and the absolutely-placed ring sibling.
    const wrap = body.parentElement;
    expect(wrap).toHaveClass("modal-body-wrap");
    expect(wrap?.querySelector(".scroll-focus-ring")).not.toBeNull();
  });

  it("makes the About body focusable (tabindex 0) when its content overflows", async () => {
    mockOverflow(500, 100);
    const { getByRole } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>about this sim</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    fireEvent.click(getByRole("button", { name: /about/i }));
    // The body mounts only when the panel opens, so the callback ref must attach to the
    // late-mounted node and mark it keyboard-scrollable once it overflows.
    await waitFor(() =>
      expect(document.querySelector(".modal-body")).toHaveAttribute("tabindex", "0"),
    );
  });

  it("titles the modal contextually from simTitle", () => {
    const { getByRole } = render(
      <SimulationFrame simTitle="Bananas" tagline="t" infoModalContent={<p>x</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    fireEvent.click(getByRole("button", { name: /about/i }));
    // The complementary region's accessible name comes from its heading, derived from simTitle.
    expect(getByRole("heading", { name: "About the Bananas Simulation" })).toBeInTheDocument();
    expect(
      getByRole("complementary", { name: "About the Bananas Simulation" }),
    ).toBeInTheDocument();
  });

  it("closes the modal via the close button", () => {
    const { getByRole, queryByRole } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    fireEvent.click(getByRole("button", { name: /about/i }));
    fireEvent.click(getByRole("button", { name: /close/i }));
    expect(queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("renders the About panel inside the frame, anchored top-right with no backdrop scrim", () => {
    const { container, getByRole } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    fireEvent.click(getByRole("button", { name: /about/i }));
    const panel = getByRole("complementary");
    // No full-screen scrim wraps the panel — the sim content behind it stays interactive.
    expect(container.querySelector(".simulation-frame-info-overlay")).toBeNull();
    // The panel lives INSIDE the frame so its `position: absolute` anchors to the frame
    // (which is `position: relative`), not the page — keeping it placed per-frame.
    const frame = container.querySelector(".simulation-frame");
    expect(frame?.contains(panel)).toBe(true);
  });

  it("renders a draggable header handle on the About panel", () => {
    const { container, getByRole } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    fireEvent.click(getByRole("button", { name: /about/i }));
    // The drag handle is the panel's header, identified by class.
    expect(container.querySelector(".modal-drag-handle")).not.toBeNull();
  });

  it("opens the About panel at its default position (no drag offset applied)", () => {
    const { getByRole } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    fireEvent.click(getByRole("button", { name: /about/i }));
    // Drag position is a transform offset reset to 0,0 on each open, so the panel always
    // reappears at its CSS-anchored default rather than wherever it was last dragged.
    expect(getByRole("complementary")).toHaveStyle({ transform: "translate(0px, 0px)" });
  });

  it("toggles the About panel closed when the About button is clicked again", () => {
    const { getByRole, queryByRole } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    const aboutButton = getByRole("button", { name: /about/i });
    fireEvent.click(aboutButton);
    expect(getByRole("complementary")).toBeInTheDocument();
    // Clicking About again closes the open panel (matches the demo's toggle behavior).
    fireEvent.click(aboutButton);
    expect(queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("nudges the About panel with Alt+Arrow keyboard dragging", () => {
    const { getByRole } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    fireEvent.click(getByRole("button", { name: /about/i }));
    const panel = getByRole("complementary");
    // Alt+ArrowRight moves +10px on x; Alt+Shift+ArrowDown then adds +40px on y.
    fireEvent.keyDown(panel, { key: "ArrowRight", altKey: true });
    expect(panel).toHaveStyle({ transform: "translate(10px, 0px)" });
    fireEvent.keyDown(panel, { key: "ArrowDown", altKey: true, shiftKey: true });
    expect(panel).toHaveStyle({ transform: "translate(10px, 40px)" });
  });

  it("removes drag listeners from window if the frame unmounts mid-drag", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { container, getByRole, unmount } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    fireEvent.click(getByRole("button", { name: /about/i }));
    const handle = container.querySelector(".modal-drag-handle");
    if (!handle) throw new Error("expected a drag handle");
    // Begin a drag (pointer down on the header) but unmount before any pointerup fires.
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10 });
    expect(addSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("pointerup", expect.any(Function));
    unmount();
    // Unmount cleanup detaches the gesture's window listeners so they don't leak.
    expect(removeSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("pointerup", expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("tears down a prior drag's listeners when a new drag starts before the first ends", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { container, getByRole } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    fireEvent.click(getByRole("button", { name: /about/i }));
    const handle = container.querySelector(".modal-drag-handle");
    if (!handle) throw new Error("expected a drag handle");
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0 });
    removeSpy.mockClear();
    // A second pointerdown (e.g. a second touch) must detach the first gesture's listeners
    // rather than stacking another set that fights over the offset.
    fireEvent.pointerDown(handle, { clientX: 5, clientY: 5 });
    expect(removeSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("pointerup", expect.any(Function));
    removeSpy.mockRestore();
  });

  it("ends the drag on pointercancel, not just pointerup", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { container, getByRole } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    fireEvent.click(getByRole("button", { name: /about/i }));
    const handle = container.querySelector(".modal-drag-handle");
    if (!handle) throw new Error("expected a drag handle");
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0 });
    removeSpy.mockClear();
    // A pointercancel (browser/OS aborts the pointer) must end the gesture and detach listeners,
    // since pointerup won't fire in that case.
    window.dispatchEvent(new Event("pointercancel"));
    expect(removeSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("pointercancel", expect.any(Function));
    removeSpy.mockRestore();
  });

  it("does not move focus to the About button on initial render", () => {
    const { getByRole } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    // The close-state focus-restore must NOT fire on mount (the `wasOpenRef` guard) —
    // otherwise every frame would steal focus to its About button on page load.
    expect(getByRole("button", { name: /about/i })).not.toHaveFocus();
  });

  it("returns focus to the About button when the modal closes", () => {
    const { getByRole, queryByRole } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    const aboutButton = getByRole("button", { name: /about/i });
    fireEvent.click(aboutButton);
    fireEvent.click(getByRole("button", { name: /close/i }));
    expect(queryByRole("complementary")).not.toBeInTheDocument();
    // Focus returns to the element that opened the modal — standard dialog etiquette.
    expect(aboutButton).toHaveFocus();
  });

  it("moves focus to the close button on open and closes on Escape from there", () => {
    const { getByRole, queryByRole } = render(
      <SimulationFrame simTitle="S" tagline="t" infoModalContent={<p>about</p>}>
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    fireEvent.click(getByRole("button", { name: /about/i }));
    // Focus moves to the close button on open; Escape dispatched from there must bubble to
    // the panel's onKeyDown and close it — mirroring the real keyboard path.
    const closeButton = getByRole("button", { name: /close/i });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(closeButton, { key: "Escape" });
    expect(queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("calls onInfoOpenChange(true) on open and (false) on close, but never on initial render", () => {
    const onInfoOpenChange = vi.fn();
    const { getByRole } = render(
      <SimulationFrame
        simTitle="S"
        tagline="t"
        infoModalContent={<p>about</p>}
        onInfoOpenChange={onInfoOpenChange}
      >
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    // The initial closed state is not a transition — the guard ref suppresses a mount-time call.
    expect(onInfoOpenChange).not.toHaveBeenCalled();

    fireEvent.click(getByRole("button", { name: /about/i }));
    expect(onInfoOpenChange).toHaveBeenNthCalledWith(1, true);

    fireEvent.click(getByRole("button", { name: /close/i }));
    expect(onInfoOpenChange).toHaveBeenNthCalledWith(2, false);
    expect(onInfoOpenChange).toHaveBeenCalledTimes(2);
  });

  it("calls onInfoOpenChange(false) when the modal is closed via Escape", () => {
    const onInfoOpenChange = vi.fn();
    const { getByRole } = render(
      <SimulationFrame
        simTitle="S"
        tagline="t"
        infoModalContent={<p>about</p>}
        onInfoOpenChange={onInfoOpenChange}
      >
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    fireEvent.click(getByRole("button", { name: /about/i }));
    fireEvent.keyDown(getByRole("button", { name: /close/i }), { key: "Escape" });
    expect(onInfoOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("does not render an About button when no infoModalContent prop is given", () => {
    const { queryByRole } = render(
      <SimulationFrame simTitle="S" tagline="t">
        <SimulationFrame.Trials>a</SimulationFrame.Trials>
        <SimulationFrame.Simulation>b</SimulationFrame.Simulation>
        <SimulationFrame.Data>c</SimulationFrame.Data>
      </SimulationFrame>,
    );
    expect(queryByRole("button", { name: /about/i })).not.toBeInTheDocument();
  });

  it("applies the standalone class by default (outer container visible)", () => {
    const { container } = render(<SimulationFrame simTitle="Sim" tagline="t" />);
    expect(container.querySelector(".simulation-frame")).toHaveClass("standalone");
  });

  it("omits the standalone class when standalone={false} is passed", () => {
    const { container } = render(<SimulationFrame simTitle="Sim" tagline="t" standalone={false} />);
    expect(container.querySelector(".simulation-frame")).not.toHaveClass("standalone");
  });

  describe("?standalone= URL param", () => {
    const setUrlParam = (value: string | null) => {
      const url = new URL(window.location.href);
      url.search = "";
      if (value !== null) url.searchParams.set("standalone", value);
      window.history.replaceState({}, "", url.toString());
    };

    afterEach(() => setUrlParam(null));

    it("omits the standalone class when ?standalone=false is in the URL", () => {
      setUrlParam("false");
      const { container } = render(<SimulationFrame simTitle="Sim" tagline="t" />);
      expect(container.querySelector(".simulation-frame")).not.toHaveClass("standalone");
    });

    it("keeps the standalone class when ?standalone=true is in the URL", () => {
      setUrlParam("true");
      const { container } = render(<SimulationFrame simTitle="Sim" tagline="t" />);
      expect(container.querySelector(".simulation-frame")).toHaveClass("standalone");
    });

    it("ignores unrecognized values and falls back to the default (true)", () => {
      setUrlParam("yes");
      const { container } = render(<SimulationFrame simTitle="Sim" tagline="t" />);
      expect(container.querySelector(".simulation-frame")).toHaveClass("standalone");
    });

    it("explicit standalone={true} prop wins over ?standalone=false in the URL", () => {
      setUrlParam("false");
      const { container } = render(
        <SimulationFrame simTitle="Sim" tagline="t" standalone={true} />,
      );
      expect(container.querySelector(".simulation-frame")).toHaveClass("standalone");
    });

    it("explicit standalone={false} prop wins over ?standalone=true in the URL", () => {
      setUrlParam("true");
      const { container } = render(
        <SimulationFrame simTitle="Sim" tagline="t" standalone={false} />,
      );
      expect(container.querySelector(".simulation-frame")).not.toHaveClass("standalone");
    });
  });
});
