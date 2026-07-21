import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NoreasterDataPanel } from "./data-panel";

// The six weather attributes in their rendered order, with the two condensable long labels flagged.
const ATTRIBUTES = [
  "Sky",
  "Pressure",
  "Wind",
  "Precipitation Type",
  "Precipitation Amount",
  "Storm Intensity",
];

describe("NoreasterDataPanel — static layout", () => {
  it("renders the 'Weather Outcome' subsection heading (level 3)", () => {
    const { getByRole } = render(<NoreasterDataPanel />);
    expect(getByRole("heading", { level: 3, name: "Weather Outcome" })).toBeInTheDocument();
  });

  it("renders the outcome pill in its empty default state (en-dash placeholder)", () => {
    const { container } = render(<NoreasterDataPanel />);
    const pill = container.querySelector(".wo-pill");
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent("–");
  });

  it("renders all six attribute rows as row headers, in order", () => {
    const { getAllByRole } = render(<NoreasterDataPanel />);
    const rowHeaders = getAllByRole("rowheader");
    expect(rowHeaders).toHaveLength(ATTRIBUTES.length);
    // Condensable rows also render the short span, so match the full label as a substring in order.
    rowHeaders.forEach((th, i) => {
      expect(th).toHaveTextContent(ATTRIBUTES[i]);
    });
  });

  it("names each row header for assistive tech by its FULL attribute (even the condensable ones)", () => {
    const { getByRole } = render(<NoreasterDataPanel />);
    for (const label of ATTRIBUTES) {
      expect(getByRole("rowheader", { name: label })).toBeInTheDocument();
    }
  });

  it("renders a placeholder value cell (en-dash) for every attribute row", () => {
    const { container } = render(<NoreasterDataPanel />);
    const values = container.querySelectorAll(".wo-value");
    expect(values).toHaveLength(ATTRIBUTES.length);
    for (const value of values) expect(value.textContent).toBe("–");
  });

  it("reserves an aria-hidden stand-in icon slot in every row", () => {
    const { container } = render(<NoreasterDataPanel />);
    const icons = container.querySelectorAll(".wo-icon");
    expect(icons).toHaveLength(ATTRIBUTES.length);
    // The disc is CSS-only, so assert presence + aria-hidden (jsdom won't resolve the background).
    for (const icon of icons) expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the condensable labels' short forms out of the accessibility tree", () => {
    const { container } = render(<NoreasterDataPanel />);
    // Both visible label spans live under an aria-hidden wrapper (the row's accessible name is its
    // aria-label), so neither the full nor the short text double-announces.
    const condensableWrappers = container.querySelectorAll(".wo-label[aria-hidden='true']");
    expect(condensableWrappers).toHaveLength(2);
    expect(container.querySelectorAll(".wo-label-short")).toHaveLength(2);
    expect(container.querySelectorAll(".wo-label-full")).toHaveLength(2);
  });
});
