import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Histogram } from "./histogram";

describe("Histogram", () => {
  it("renders the empty state when values is empty", () => {
    const { getByText, container } = render(
      <Histogram values={[]} height={160} ariaLabel="Test histogram" />,
    );
    expect(getByText("No data")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders a custom empty-state message when supplied", () => {
    const { getByText } = render(<Histogram values={[]} height={160} emptyState="Run a trial" />);
    expect(getByText("Run a trial")).toBeInTheDocument();
  });

  it("renders an SVG with one <rect> per non-empty bin", () => {
    // Values 0..20 with targetBinCount = 5 → binWidth = niceStep(20/5) = 5 → bins of 5 each.
    const values = Array.from({ length: 21 }, (_, i) => i);
    const { container } = render(
      <Histogram values={values} targetBinCount={5} height={160} ariaLabel="dist" />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
    const bars = container.querySelectorAll("rect.histogram-bar");
    expect(bars.length).toBeGreaterThan(0);
  });

  it("does NOT render a <rect> for empty bins (count === 0)", () => {
    // Cluster all values into the first bin so other bins are empty.
    const values = [0, 0, 0, 0];
    const { container } = render(<Histogram values={values} targetBinCount={5} height={160} />);
    const bars = container.querySelectorAll("rect.histogram-bar");
    expect(bars.length).toBe(1);
  });

  it("exposes the ariaLabel on the chart region", () => {
    const { getByLabelText } = render(
      <Histogram values={[1, 2, 3]} height={160} ariaLabel="Distance distribution" />,
    );
    expect(getByLabelText("Distance distribution")).toBeInTheDocument();
  });

  it("does not expose an img role when no ariaLabel is given (no unlabeled image)", () => {
    const { queryByRole } = render(<Histogram values={[1, 2, 3]} height={160} />);
    // A role="img" with no accessible name is a WCAG 1.1.1 failure; unlabeled, the region is
    // decorative and claims no image role at all.
    expect(queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders x and y axis titles when supplied", () => {
    const { getByText } = render(
      <Histogram
        values={[1, 2, 3]}
        height={160}
        xLabel="Distance from start"
        yLabel="# of walkers"
      />,
    );
    expect(getByText("Distance from start")).toBeInTheDocument();
    expect(getByText("# of walkers")).toBeInTheDocument();
  });

  it("labels every bin boundary on the x-axis (one more label than bin count)", () => {
    const values = [0, 5, 10, 15, 20];
    const { container } = render(<Histogram values={values} targetBinCount={5} height={160} />);
    const labels = container.querySelectorAll(".histogram-x-tick-label");
    expect(labels.length).toBeGreaterThanOrEqual(2);
  });

  it("formats fractional bin-boundary labels without floating-point noise", () => {
    // maxValue 1, target 5 → binWidth 0.2; boundary 3 (3 * 0.2) is 0.6000000000000001 raw.
    const { container } = render(
      <Histogram values={[0, 0.5, 1]} targetBinCount={5} height={160} />,
    );
    const labels = Array.from(
      container.querySelectorAll(".histogram-x-tick-label"),
      (el) => el.textContent,
    );
    expect(labels).toContain("0.6");
    expect(labels.some((t) => t?.includes("0.6000000000000001"))).toBe(false);
  });
});
