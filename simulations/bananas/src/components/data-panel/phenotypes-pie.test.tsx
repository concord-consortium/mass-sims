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
});
