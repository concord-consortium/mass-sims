import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataSubsection } from "./data-subsection";

describe("DataSubsection", () => {
  it("renders the title as an h3", () => {
    const { getByRole } = render(
      <DataSubsection title="Offspring Phenotypes">body</DataSubsection>,
    );
    const heading = getByRole("heading", { level: 3, name: "Offspring Phenotypes" });
    expect(heading).toBeInTheDocument();
  });

  it("renders children", () => {
    const { getByText } = render(
      <DataSubsection title="Fungus Resistance">chart content</DataSubsection>,
    );
    expect(getByText("chart content")).toBeInTheDocument();
  });

  it("renders the root with the data-subsection class for sibling-divider styling", () => {
    const { container } = render(<DataSubsection title="x">body</DataSubsection>);
    expect(container.firstChild).toHaveClass("data-subsection");
  });

  it("supports any count of siblings (one, two, three) without complaint", () => {
    const { getAllByRole } = render(
      <div>
        <DataSubsection title="One">a</DataSubsection>
        <DataSubsection title="Two">b</DataSubsection>
        <DataSubsection title="Three">c</DataSubsection>
      </div>,
    );
    expect(getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });
});
