import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LabControls } from "./lab-controls";

const base = {
  test: "water" as const,
  setting: null,
  hasLump: true,
  spent: false,
  running: false,
  onTestChange: () => undefined,
  onSettingChange: () => undefined,
  onObserve: () => undefined,
  onWaft: () => undefined,
  onRun: () => undefined,
  onResetTrial: () => undefined,
};

describe("LabControls", () => {
  it("offers the four destructive tests, and not the free ones", () => {
    const { getByRole, queryByRole } = render(<LabControls {...base} />);
    for (const label of ["Water", "Vinegar", "Warm bath", "UV lamp"]) {
      expect(getByRole("button", { name: label })).toBeInTheDocument();
    }
    // Handling has its own button; it must never look like a test you could spend a lump on.
    expect(queryByRole("button", { name: "Handle" })).toBeNull();
  });

  it("disables the dial for a test that has none, and enables it for the bath", () => {
    const { container, rerender } = render(<LabControls {...base} />);
    expect(container.querySelector(".setting-select")).toHaveAttribute("data-disabled");
    rerender(<LabControls {...base} test="bath" setting="60" />);
    expect(container.querySelector(".setting-select")).not.toHaveAttribute("data-disabled");
  });

  it("keeps Observe and Waft working after the lump's test is spent, but not Run", () => {
    const { getByRole } = render(<LabControls {...base} spent={true} />);
    // This is the whole reason a spent lump stays on the bench: the rancid smell is found here.
    expect(getByRole("button", { name: /observe/i })).toBeEnabled();
    expect(getByRole("button", { name: /waft/i })).toBeEnabled();
    expect(getByRole("button", { name: /run test/i })).toBeDisabled();
  });

  it("disables everything that needs a lump when the bench is empty", () => {
    const { getByRole } = render(<LabControls {...base} hasLump={false} />);
    expect(getByRole("button", { name: /observe/i })).toBeDisabled();
    expect(getByRole("button", { name: /waft/i })).toBeDisabled();
    expect(getByRole("button", { name: /run test/i })).toBeDisabled();
  });

  it("reports a change of test", () => {
    const onTestChange = vi.fn();
    const { getByRole } = render(<LabControls {...base} onTestChange={onTestChange} />);
    fireEvent.click(getByRole("button", { name: "UV lamp" }));
    expect(onTestChange).toHaveBeenCalledWith("lamp");
  });
});
