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
  running: false,
  timerEpoch: 0,
  message: null,
  onTestChange: () => undefined,
  onExamine: () => undefined,
  onRun: () => undefined,
  onResetTest: () => undefined,
};

describe("TestLab", () => {
  it("asks for a lump when the bench is empty", () => {
    const { getByText } = render(<TestLab {...base} selectedLump={null} />);
    expect(getByText(/pick a sample from the tray/i)).toBeInTheDocument();
  });

  it("names the apparatus for the chosen test", () => {
    const { getByText, rerender } = render(<TestLab {...base} selectedLump="1" />);
    expect(getByText(/tube of vinegar/i)).toBeInTheDocument();
    rerender(<TestLab {...base} selectedLump="1" test="bath" />);
    expect(getByText(/dry dish in a warm bath/i)).toBeInTheDocument();
    rerender(<TestLab {...base} selectedLump="1" test="lamp" />);
    expect(getByText(/uv lamp, two weeks/i)).toBeInTheDocument();
  });

  it("writes the bath's temperatures on it and lights each in turn as the run goes", () => {
    const { container, getByText } = render(
      <TestLab {...base} selectedLump="4" test="bath" running={true} />,
    );
    const current = () => container.querySelector(".bath-dial .current")?.textContent ?? null;
    expect(getByText("45 °C")).toBeInTheDocument();
    paint(0);
    expect(current()).toBeNull();
    paint(RUN_MS * 0.1);
    expect(current()).toBe("30 °C");
    paint(RUN_MS * 0.5);
    expect(current()).toBe("45 °C");
    paint(RUN_MS);
    expect(current()).toBe("80 °C");
  });

  it("keeps a spent lump on the bench", () => {
    const trial = applyTest(makeEmptyTrial(), "4", "lamp");
    const { getByText } = render(<TestLab {...base} trial={trial} selectedLump="4" />);
    expect(getByText("Sample 4")).toBeInTheDocument();
  });

  it("shows the span a test will take before anything is run", () => {
    // The meter is always on the bench, so a student can see what they are committing a lump to.
    const { getByRole } = render(<TestLab {...base} selectedLump="1" />);
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
      <TestLab {...base} selectedLump="1" test="lamp" running={true} />,
    );
    paint(0);
    paint(RUN_MS);
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1209600");

    rerender(<TestLab {...base} selectedLump="1" test="water" running={true} />);
    const bar = getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemax", "120");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
  });

  it("empties the bar when the lump's test is reset", () => {
    const trial = applyTest(makeEmptyTrial(), "1", "vinegar");
    const { getByRole, rerender } = render(
      <TestLab {...base} trial={trial} selectedLump="1" running={true} />,
    );
    paint(0);
    paint(RUN_MS);
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuenow", "120");

    // What Reset Test does: the lump gets its material back and the epoch moves on.
    rerender(
      <TestLab {...base} selectedLump="1" running={false} timerEpoch={base.timerEpoch + 1} />,
    );
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("counts the lamp out over two weeks", () => {
    const { getByRole } = render(<TestLab {...base} selectedLump="1" test="lamp" running={true} />);
    expect(getByRole("progressbar")).toHaveAttribute("aria-valuemax", "1209600");
  });

  it("sends the lump to the apparatus for a run, and leaves it there once spent", () => {
    const { container, rerender } = render(<TestLab {...base} selectedLump="1" />);
    const lump = () => container.querySelector(".bench-lump");
    // At rest on the counter before anything is run.
    expect(lump()).not.toHaveClass("staged");

    rerender(<TestLab {...base} selectedLump="1" running={true} />);
    expect(lump()).toHaveClass("staged");

    // The run is over but the lump stays in the apparatus, so the bench still reads as a record.
    const trial = applyTest(makeEmptyTrial(), "1", "vinegar");
    rerender(<TestLab {...base} trial={trial} selectedLump="1" running={false} />);
    expect(lump()).toHaveClass("staged");
  });

  it("brings the lump back to rest when its test is reset", () => {
    const trial = applyTest(makeEmptyTrial(), "1", "vinegar");
    const { container, rerender } = render(<TestLab {...base} trial={trial} selectedLump="1" />);
    expect(container.querySelector(".bench-lump")).toHaveClass("staged");
    rerender(<TestLab {...base} selectedLump="1" />);
    expect(container.querySelector(".bench-lump")).not.toHaveClass("staged");
  });

  it("shows the latest observation", () => {
    const { getByText } = render(
      <TestLab {...base} selectedLump="1" message="A sharp, rancid smell." />,
    );
    expect(getByText("A sharp, rancid smell.")).toBeInTheDocument();
  });

  it("keeps Look, feel, smell on the counter, and out of reach while a test runs", () => {
    const { getByRole, queryByRole, rerender } = render(<TestLab {...base} selectedLump={null} />);
    expect(queryByRole("button", { name: /look, feel, smell/i })).toBeNull();
    rerender(<TestLab {...base} selectedLump="1" />);
    const examine = getByRole("button", { name: /look, feel, smell/i });
    // It stays on the counter rather than travelling to the apparatus with the lump.
    expect(examine.closest(".bench-lump")).toBeNull();
    expect(examine).toBeEnabled();
    rerender(<TestLab {...base} selectedLump="1" running={true} />);
    // Examining mid-run would describe the result before the test had finished.
    expect(getByRole("button", { name: /look, feel, smell/i })).toBeDisabled();
  });

  it("swaps Run for Reset Test once the lump's test has run", () => {
    const { getByRole, queryByRole, rerender } = render(<TestLab {...base} selectedLump={null} />);
    expect(getByRole("button", { name: /run test/i })).toBeDisabled();
    rerender(<TestLab {...base} selectedLump="1" />);
    expect(getByRole("button", { name: /run test/i })).toBeEnabled();
    expect(queryByRole("button", { name: /reset test/i })).toBeNull();

    const trial = applyTest(makeEmptyTrial(), "1", "vinegar");
    rerender(<TestLab {...base} trial={trial} selectedLump="1" running={true} />);
    expect(queryByRole("button", { name: /run test/i })).toBeNull();
    expect(getByRole("button", { name: /reset test/i })).toBeDisabled();
    rerender(<TestLab {...base} trial={trial} selectedLump="1" />);
    expect(getByRole("button", { name: /reset test/i })).toBeEnabled();
  });

  it("has no control for resetting the whole trial", () => {
    // That belongs to the trial card; the bench reaches only the lump on it.
    const trial = applyTest(makeEmptyTrial(), "1", "vinegar");
    const { queryByRole } = render(<TestLab {...base} trial={trial} selectedLump="1" />);
    expect(queryByRole("button", { name: /reset trial/i })).toBeNull();
  });
});
