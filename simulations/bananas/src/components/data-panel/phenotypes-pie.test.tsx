import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EMPTY_STATE_LABEL } from "./constants";
import { PhenotypesPie } from "./phenotypes-pie";

describe("PhenotypesPie — empty state", () => {
  it("renders an SVG with role=img and the no-data aria-label", () => {
    const { getByRole } = render(<PhenotypesPie totals={null} />);
    expect(getByRole("img", { name: "Offspring phenotypes: no data" })).toBeInTheDocument();
  });

  it("shows the 'No data' label", () => {
    const { getByText } = render(<PhenotypesPie totals={null} />);
    expect(getByText(EMPTY_STATE_LABEL)).toBeInTheDocument();
  });

  it("renders the empty-state circle (styled with the theme title-bar background via class)", () => {
    const { container } = render(<PhenotypesPie totals={null} />);
    expect(container.querySelector(".phenotypes-pie__circle")).toBeInTheDocument();
  });

  it("renders the empty state when totals sum to zero", () => {
    const { getByText } = render(<PhenotypesPie totals={{ healthy: 0, infected: 0 }} />);
    expect(getByText(EMPTY_STATE_LABEL)).toBeInTheDocument();
  });
});

describe("PhenotypesPie — slices", () => {
  it("renders a healthy and an infected slice path for a two-slice split", () => {
    const { container } = render(<PhenotypesPie totals={{ healthy: 5, infected: 5 }} />);
    expect(container.querySelector("path.phenotypes-pie__slice--healthy")).toBeInTheDocument();
    expect(container.querySelector("path.phenotypes-pie__slice--infected")).toBeInTheDocument();
  });

  it("labels both slices with their rounded percentages", () => {
    const { getAllByText } = render(<PhenotypesPie totals={{ healthy: 5, infected: 5 }} />);
    expect(getAllByText("50%")).toHaveLength(2);
  });

  it("renders a single slice labelled 100% at the circle center", () => {
    const { container, getByText } = render(
      <PhenotypesPie totals={{ healthy: 12, infected: 0 }} />,
    );
    expect(container.querySelectorAll("path.phenotypes-pie__slice")).toHaveLength(1);
    const label = getByText("100%");
    expect(label).toHaveAttribute("x", "80");
    expect(label).toHaveAttribute("y", "49");
  });

  it("draws a sliver slice (≤ 8%) but hides its label", () => {
    // 2 / 25 = 8% exactly → below the > 8% label threshold, so no "8%" text.
    const { container, queryByText } = render(
      <PhenotypesPie totals={{ healthy: 23, infected: 2 }} />,
    );
    expect(container.querySelector("path.phenotypes-pie__slice--infected")).toBeInTheDocument();
    expect(queryByText("8%")).not.toBeInTheDocument();
  });

  it("derives the aria-label percentages from totals", () => {
    const { getByRole } = render(<PhenotypesPie totals={{ healthy: 5, infected: 5 }} />);
    expect(getByRole("img", { name: /50% healthy, 50% infected/ })).toBeInTheDocument();
  });

  it("names the selected cross scope in the aria-label", () => {
    const { getByRole } = render(
      <PhenotypesPie totals={{ healthy: 12, infected: 0 }} selectedCrossLabel="cross 2" />,
    );
    expect(
      getByRole("img", { name: "Offspring phenotypes for cross 2: 100% healthy, 0% infected" }),
    ).toBeInTheDocument();
  });
});
