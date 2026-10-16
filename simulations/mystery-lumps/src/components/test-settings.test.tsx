import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { applyTest, makeEmptyTrial } from "../model/trial";
import { TestSettings } from "./test-settings";

function renderGrid(trial = makeEmptyTrial(), onRun = vi.fn()) {
  const utils = render(
    <TestSettings trial={trial} running={false} onRun={onRun} onResetTrial={() => undefined} />,
  );
  return { ...utils, onRun };
}

describe("TestSettings", () => {
  it("offers only lumps that still have material", () => {
    const trial = applyTest(makeEmptyTrial(), "B", "water", null);
    const { getByRole } = renderGrid(trial);
    fireEvent.click(getByRole("button", { name: /lump/i }));
    expect(getByRole("option", { name: "A" })).toBeInTheDocument();
    expect(() => getByRole("option", { name: "B" })).toThrow();
  });

  it("runs the chosen lump, test and setting", () => {
    const { getByRole, onRun } = renderGrid();
    fireEvent.click(getByRole("button", { name: /^run$/i }));
    // Defaults: the first untested lump and the first test, which has no setting.
    expect(onRun).toHaveBeenCalledWith("A", "water", null);
  });

  it("disables the setting dropdown for a test with no dial", () => {
    const { container } = renderGrid();
    const setting = container.querySelector(".setting-select");
    expect(setting).toHaveAttribute("data-disabled");
  });

  it("cannot run while a test is already running", () => {
    const { getByRole } = render(
      <TestSettings
        trial={makeEmptyTrial()}
        running={true}
        onRun={vi.fn()}
        onResetTrial={() => undefined}
      />,
    );
    expect(getByRole("button", { name: /^run$/i })).toBeDisabled();
  });

  it("says so when every lump has been spent", () => {
    let trial = makeEmptyTrial();
    for (const lump of ["A", "B", "C", "D", "E"] as const) {
      trial = applyTest(trial, lump, "water", null);
    }
    const { getByText, getByRole } = renderGrid(trial);
    expect(getByText(/no material left/i)).toBeInTheDocument();
    expect(getByRole("button", { name: /^run$/i })).toBeDisabled();
  });
});
