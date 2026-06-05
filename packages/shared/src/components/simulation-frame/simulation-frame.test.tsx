import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SimulationFrame } from "./simulation-frame";

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
    expect(getByRole("button", { name: "About" })).toBeInTheDocument();
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
    expect(queryByRole("dialog")).not.toBeInTheDocument();
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
    expect(getByRole("dialog")).toBeInTheDocument();
    expect(getByText("about this sim")).toBeInTheDocument();
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
    // The dialog's accessible name comes from its heading, derived from simTitle.
    expect(getByRole("heading", { name: "About the Bananas Simulation" })).toBeInTheDocument();
    expect(getByRole("dialog", { name: "About the Bananas Simulation" })).toBeInTheDocument();
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
    expect(queryByRole("dialog")).not.toBeInTheDocument();
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
    const dialog = getByRole("dialog");
    // No full-screen scrim wraps the dialog — the sim content behind it stays interactive.
    expect(container.querySelector(".simulation-frame-info-overlay")).toBeNull();
    // The panel lives INSIDE the frame so its `position: absolute` anchors to the frame
    // (which is `position: relative`), not the page — keeping it placed per-frame.
    const frame = container.querySelector(".simulation-frame");
    expect(frame?.contains(dialog)).toBe(true);
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
    expect(getByRole("dialog")).toHaveStyle({ transform: "translate(0px, 0px)" });
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
    expect(getByRole("dialog")).toBeInTheDocument();
    // Clicking About again closes the open panel (matches the demo's toggle behavior).
    fireEvent.click(aboutButton);
    expect(queryByRole("dialog")).not.toBeInTheDocument();
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
    const dialog = getByRole("dialog");
    // Alt+ArrowRight moves +10px on x; Alt+Shift+ArrowDown then adds +40px on y.
    fireEvent.keyDown(dialog, { key: "ArrowRight", altKey: true });
    expect(dialog).toHaveStyle({ transform: "translate(10px, 0px)" });
    fireEvent.keyDown(dialog, { key: "ArrowDown", altKey: true, shiftKey: true });
    expect(dialog).toHaveStyle({ transform: "translate(10px, 40px)" });
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
    expect(queryByRole("dialog")).not.toBeInTheDocument();
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
    // the dialog's onKeyDown and close it — mirroring the real keyboard path.
    const closeButton = getByRole("button", { name: /close/i });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(closeButton, { key: "Escape" });
    expect(queryByRole("dialog")).not.toBeInTheDocument();
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
});
