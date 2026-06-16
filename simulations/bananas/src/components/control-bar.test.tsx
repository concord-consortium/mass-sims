import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ControlBar } from "./control-bar";

describe("ControlBar", () => {
  it("renders three buttons: Cross Plants, Introduce Fungus, Reset Trial", () => {
    const { getByRole } = render(<ControlBar />);
    expect(getByRole("button", { name: "Cross Plants" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Introduce Fungus" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Reset Trial" })).toBeInTheDocument();
  });

  it("renders all three buttons in their disabled state", () => {
    const { getByRole } = render(<ControlBar />);
    expect(getByRole("button", { name: "Cross Plants" })).toBeDisabled();
    expect(getByRole("button", { name: "Introduce Fungus" })).toBeDisabled();
    expect(getByRole("button", { name: "Reset Trial" })).toBeDisabled();
  });

  it("renders a decorative icon <svg> inside each button", () => {
    const { getByRole } = render(<ControlBar />);
    for (const label of ["Cross Plants", "Introduce Fungus", "Reset Trial"]) {
      const button = getByRole("button", { name: label });
      const icon = button.querySelector("svg");
      // aria-hidden so the icon is decorative; the label is the accessible name.
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });
});
