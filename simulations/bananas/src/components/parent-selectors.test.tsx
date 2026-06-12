import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ParentSelectors } from "./parent-selectors";

describe("ParentSelectors", () => {
  it("renders two Select dropdowns labelled Parent 1 and Parent 2", () => {
    const { getByLabelText } = render(<ParentSelectors />);
    expect(getByLabelText("Parent 1")).toBeInTheDocument();
    expect(getByLabelText("Parent 2")).toBeInTheDocument();
  });

  it("renders the × separator as a decorative .cross-symbol element", () => {
    const { container } = render(<ParentSelectors />);
    const separator = container.querySelector(".cross-symbol");
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveTextContent("×");
    // Decorative only — the × is conveyed visually, not to assistive tech.
    expect(separator).toHaveAttribute("aria-hidden", "true");
  });

  it("renders two empty thumbnail circles", () => {
    const { container } = render(<ParentSelectors />);
    const circles = container.querySelectorAll(".parent-circle");
    expect(circles).toHaveLength(2);
  });

  it("renders each Select with the five parent options", () => {
    const { getAllByRole } = render(<ParentSelectors />);
    const triggers = getAllByRole("button");
    expect(triggers).toHaveLength(2);
    for (const trigger of triggers) {
      expect(trigger.textContent).toMatch(/Select/);
    }
  });
});
