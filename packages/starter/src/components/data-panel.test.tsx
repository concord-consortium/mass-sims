import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RecordedTrial, Walker } from "../model/types";
import { DataPanel } from "./data-panel";

const runTrial = (avg: number, walkers: Walker[] = [{ x: 3, y: 4 }]): RecordedTrial => ({
  input: { walkerCount: walkers.length, stepSize: 1, framesPerTrial: 100, seed: "x" },
  output: { avgDistance: avg, stdDevDistance: 2, avgDistanceSeries: [1, 2, 3, 4, 5] },
  finalTransient: { frame: 100, walkers, avgDistanceSeries: [1, 2, 3, 4, 5] },
});

const emptyTrial = (): RecordedTrial => ({
  input: { walkerCount: 50, stepSize: 1, framesPerTrial: 100, seed: "x" },
  output: null,
  finalTransient: null,
});

describe("DataPanel", () => {
  it("renders both DataSubsection h3 headings", () => {
    const { getAllByRole } = render(<DataPanel trial={null} />);
    expect(getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });

  it("renders the Final Distance Distribution histogram for a completed selected trial", () => {
    const { getByRole, getByLabelText } = render(
      <DataPanel trial={runTrial(5, [{ x: 3, y: 4 }])} />,
    );
    expect(
      getByRole("heading", { level: 3, name: "Final Distance Distribution" }),
    ).toBeInTheDocument();
    expect(getByLabelText(/distance distribution/i)).toBeInTheDocument();
  });

  it("renders the histogram frame even for an empty (unrun) selected trial", () => {
    // Empty trial → the histogram shows a "No data" text placeholder. It is deliberately NOT a
    // role="img" with an aria-label (an atomic img role would hide the message from screen readers),
    // so the subsection heading identifies the chart and the placeholder text conveys the state.
    const { getByRole } = render(<DataPanel trial={emptyTrial()} />);
    const heading = getByRole("heading", { level: 3, name: "Final Distance Distribution" });
    const subsection = heading.closest(".data-subsection");
    expect(subsection).not.toBeNull();
    expect(within(subsection as HTMLElement).getByText("No data")).toBeInTheDocument();
  });

  it("always renders the time-series chart, with or without data", () => {
    // With data: the chart's SVG is exposed as a labeled image (role="img" + aria-label).
    const withData = render(<DataPanel trial={runTrial(5)} />);
    expect(withData.getByLabelText(/distance over time/i)).toBeInTheDocument();
    withData.unmount();

    // Empty: the chart shows a "No data" text placeholder (not a labeled image), identified by its
    // subsection heading.
    const empty = render(<DataPanel trial={emptyTrial()} />);
    const heading = empty.getByRole("heading", { level: 3, name: "Average Distance Over Time" });
    const subsection = heading.closest(".data-subsection");
    expect(subsection).not.toBeNull();
    expect(within(subsection as HTMLElement).getByText("No data")).toBeInTheDocument();
  });

  it("renders the chart with liveSeries when supplied (in-progress run on an empty trial)", () => {
    // Empty (unrun) selected trial but a live series is supplied — the chart should render with
    // the live data rather than showing "No data". jsdom can't introspect canvas pixels so we
    // assert the chart frame is present and the component renders without error.
    const { getByLabelText } = render(<DataPanel trial={emptyTrial()} liveSeries={[1, 2, 3]} />);
    expect(getByLabelText(/distance over time/i)).toBeInTheDocument();
  });

  it("falls back to the output series when liveSeries is null", () => {
    const { getByLabelText } = render(<DataPanel trial={runTrial(5)} liveSeries={null} />);
    // Check that the chart still renders against the output series.
    expect(getByLabelText(/distance over time/i)).toBeInTheDocument();
  });
});
