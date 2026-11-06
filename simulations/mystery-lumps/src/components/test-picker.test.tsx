import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TestPicker } from "./test-picker";

const base = { test: "water" as const, running: false, onTestChange: () => undefined };

describe("TestPicker", () => {
  it("offers the four destructive tests under Choose a Test, and not the free ones", () => {
    const { getByRole, queryByRole } = render(<TestPicker {...base} />);
    expect(getByRole("group", { name: "Choose a Test" })).toBeInTheDocument();
    for (const label of ["Water", "Vinegar", "Warm bath", "UV lamp"]) {
      expect(getByRole("button", { name: label })).toHaveClass("button");
    }
    expect(queryByRole("button", { name: /look, feel, smell/i })).toBeNull();
  });

  it("marks the chosen test and reports a change", () => {
    const onTestChange = vi.fn();
    const { getByRole } = render(<TestPicker {...base} onTestChange={onTestChange} />);
    expect(getByRole("button", { name: "Water" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(getByRole("button", { name: "UV lamp" }));
    expect(onTestChange).toHaveBeenCalledWith("lamp");
  });

  it("holds the choice still while a test runs", () => {
    const { getByRole } = render(<TestPicker {...base} running={true} />);
    expect(getByRole("button", { name: "Vinegar" })).toBeDisabled();
  });
});
