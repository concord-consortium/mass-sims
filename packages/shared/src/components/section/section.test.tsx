import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Section } from "./section";

describe("Section", () => {
  it("renders its children", () => {
    const { getByText } = render(<Section title="Trials">trial content</Section>);
    expect(getByText("trial content")).toBeInTheDocument();
  });

  it("renders the title as a heading", () => {
    const { getByRole } = render(<Section title="Data">body</Section>);
    expect(getByRole("heading", { name: "Data" })).toBeInTheDocument();
  });

  it("labels the region via aria-labelledby pointing at the title", () => {
    const { getByRole } = render(<Section title="Simulation">viz</Section>);
    // A <section> with an accessible name is exposed as a 'region' landmark.
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
  });

  it("wires the heading to the region with a generated id", () => {
    const { getByRole } = render(<Section title="Viz">body</Section>);
    const region = getByRole("region", { name: "Viz" });
    const heading = getByRole("heading", { name: "Viz" });
    expect(heading.id).toBeTruthy();
    expect(region.getAttribute("aria-labelledby")).toBe(heading.id);
  });

  it("keeps the region's accessible name to just the title when an instruction is present", () => {
    const { getByRole, getByText } = render(
      <Section title="Simulation" instruction="Select two parents to begin">
        viz
      </Section>,
    );
    // The instruction is supplementary: it renders, but must NOT widen the landmark name.
    expect(getByRole("region", { name: "Simulation" })).toBeInTheDocument();
    expect(getByRole("heading", { name: "Simulation" })).toBeInTheDocument();
    expect(getByText("Select two parents to begin")).toBeInTheDocument();
  });

  it("renders adjacent instruction text when provided", () => {
    const { getByText } = render(
      <Section title="Simulation" instruction="Select two parents to begin">
        viz
      </Section>,
    );
    expect(getByText("Select two parents to begin")).toBeInTheDocument();
  });

  it("merges an external className onto the root region", () => {
    const { getByRole } = render(
      <Section title="Trials" className="external-area">
        body
      </Section>,
    );
    // The SCSS-module class is absent under `css: false`, but the plain-string
    // external class is present — exactly what a slot uses to assign a grid-area.
    expect(getByRole("region", { name: "Trials" })).toHaveClass("external-area");
  });
});
