import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LineChart } from "./line-chart";

describe("LineChart", () => {
  it("renders the empty state when data has fewer than 2 points", () => {
    const { getByText, container } = render(
      <LineChart data={[]} xKey="x" yKey="y" height={130} ariaLabel="Test chart" />,
    );
    expect(getByText("No data")).toBeInTheDocument();
    // No SVG plot in the empty state.
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders a custom empty-state message when supplied", () => {
    const { getByText } = render(
      <LineChart data={[{ x: 0, y: 0 }]} xKey="x" yKey="y" height={130} emptyState="Run a trial" />,
    );
    expect(getByText("Run a trial")).toBeInTheDocument();
  });

  it("renders an SVG plot when there are ≥ 2 points", () => {
    const data = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 4 },
    ];
    const { container } = render(
      <LineChart data={data} xKey="x" yKey="y" height={130} ariaLabel="Test chart" />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
    // The polyline carries the series.
    expect(container.querySelector("polyline.line-chart-series")).toBeInTheDocument();
  });

  it("exposes the ariaLabel on the chart region", () => {
    const data = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    const { getByLabelText } = render(
      <LineChart data={data} xKey="x" yKey="y" height={130} ariaLabel="Avg distance over time" />,
    );
    expect(getByLabelText("Avg distance over time")).toBeInTheDocument();
  });

  it("does not expose an img role when no ariaLabel is given (no unlabeled image)", () => {
    const data = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    const { queryByRole } = render(<LineChart data={data} xKey="x" yKey="y" height={130} />);
    // A role="img" with no accessible name is a WCAG 1.1.1 failure; unlabeled, the region is
    // decorative and claims no image role at all.
    expect(queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders x and y axis titles when supplied", () => {
    const data = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    const { getByText } = render(
      <LineChart data={data} xKey="x" yKey="y" height={130} xLabel="Frame" yLabel="Avg distance" />,
    );
    expect(getByText("Frame")).toBeInTheDocument();
    expect(getByText("Avg distance")).toBeInTheDocument();
  });

  it("renders 3 y-tick labels (0, max/2, max) by default", () => {
    const data = [
      { x: 0, y: 0 },
      { x: 1, y: 5 },
      { x: 2, y: 10 },
    ];
    const { container } = render(<LineChart data={data} xKey="x" yKey="y" height={130} />);
    expect(container.querySelectorAll(".line-chart-y-tick-label")).toHaveLength(3);
  });
});
