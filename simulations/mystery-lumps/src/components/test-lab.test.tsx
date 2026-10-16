import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTest, makeEmptyTrial } from "../model/trial";
import { paint, stubFrames } from "../test-utils/frames";
import { TestLab } from "./test-lab";
import { RUN_MS } from "./test-timer";

beforeEach(stubFrames);
afterEach(() => vi.unstubAllGlobals());

const base = {
  trial: makeEmptyTrial(),
  test: "vinegar" as const,
  setting: null,
  running: false,
  timerEpoch: 0,
  message: null,
};

describe("TestLab", () => {
  it("asks for a lump when the bench is empty", () => {
    const { getByText } = render(<TestLab {...base} selectedLump={null} />);
    expect(getByText(/pick a lump from the tray/i)).toBeInTheDocument();
  });

  it("names the apparatus for the chosen test", () => {
    const { getByText, rerender } = render(<TestLab {...base} selectedLump="A" />);
    expect(getByText(/tube of vinegar/i)).toBeInTheDocument();
    rerender(<TestLab {...base} selectedLump="A" test="lamp" setting="fortnight" />);
    expect(getByText(/uv lamp, two weeks/i)).toBeInTheDocument();
  });

  it("keeps a spent lump on the bench", () => {
    const trial = applyTest(makeEmptyTrial(), "D", "lamp", "day");
    const { getByText } = render(<TestLab {...base} trial={trial} selectedLump="D" />);
    expect(getByText("Lump D")).toBeInTheDocument();
  });

  it("shows the span a test will take before anything is run", () => {
    // The meter is always on the bench, so a student can see what they are committing a lump to.
    const { getByRole } = render(<TestLab {...base} selectedLump="A" />);
    const bar = getByRole("progressbar");
    // Two minutes in the vinegar, whatever the seven real seconds the bar takes to fill.
    expect(bar).toHaveAttribute("aria-valuemax", "120");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
  });

  it("keeps the meter up with an empty bench", () => {
    const { getByRole } = render(<TestLab {...base} selectedLump={null} />);
    expect(getByRole("progressbar")).toBeInTheDocument();
  });

  // These two fill the bar for real before checking it goes back to empty. Asserting it is at
  // zero without painting first would pass even if nothing reset it, since jsdom never paints.
  it("restarts the bar when the chosen test changes", () => {
    const { getByRole, rerender } = render(
      <TestLab {...base} selectedLump="A" test="lamp" setting="day" running={true} />,
    );
    paint(0);
    paint(RUN_MS);
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuenow", "86400");

    rerender(<TestLab {...base} selectedLump="A" test="water" setting={null} running={true} />);
    const bar = getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemax", "120");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
  });

  it("empties the bar when the lump's test is reset", () => {
    const trial = applyTest(makeEmptyTrial(), "A", "vinegar", null);
    const { getByRole, rerender } = render(
      <TestLab {...base} trial={trial} selectedLump="A" running={true} />,
    );
    paint(0);
    paint(RUN_MS);
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuenow", "120");

    // What Reset Test does: the lump gets its material back and the epoch moves on.
    rerender(
      <TestLab {...base} selectedLump="A" running={false} timerEpoch={base.timerEpoch + 1} />,
    );
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("counts the lamp out over the exposure that was dialled in", () => {
    const { getByRole } = render(
      <TestLab {...base} selectedLump="A" test="lamp" setting="fortnight" running={true} />,
    );
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuemax", "1209600");
  });

  it("sends the lump to the apparatus for a run, and leaves it there once spent", () => {
    const { container, rerender } = render(<TestLab {...base} selectedLump="A" />);
    const lump = () => container.querySelector(".bench-lump");
    // At rest on the counter before anything is run.
    expect(lump()).not.toHaveClass("staged");

    rerender(<TestLab {...base} selectedLump="A" running={true} />);
    expect(lump()).toHaveClass("staged");

    // The run is over but the lump stays in the apparatus, so the bench still reads as a record.
    const trial = applyTest(makeEmptyTrial(), "A", "vinegar", null);
    rerender(<TestLab {...base} trial={trial} selectedLump="A" running={false} />);
    expect(lump()).toHaveClass("staged");
  });

  it("brings the lump back to rest when its test is reset", () => {
    const trial = applyTest(makeEmptyTrial(), "A", "vinegar", null);
    const { container, rerender } = render(<TestLab {...base} trial={trial} selectedLump="A" />);
    expect(container.querySelector(".bench-lump")).toHaveClass("staged");
    rerender(<TestLab {...base} selectedLump="A" />);
    expect(container.querySelector(".bench-lump")).not.toHaveClass("staged");
  });

  it("shows the latest observation", () => {
    const { getByText } = render(
      <TestLab {...base} selectedLump="A" message="A sharp, rancid smell." />,
    );
    expect(getByText("A sharp, rancid smell.")).toBeInTheDocument();
  });
});
